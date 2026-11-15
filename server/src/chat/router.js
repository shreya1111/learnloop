import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { createAuthMiddleware, requireTrustedOrigin } from "../auth/security.js";
import { GeminiProviderError } from "../ai/geminiJson.js";
import { tutorResponseSchema } from "../ai/tutor.js";
import { ChatConversation } from "../models/ChatConversation.js";
import { Course } from "../models/Course.js";
import { LessonState } from "../models/LessonState.js";
import { Transcript } from "../models/Transcript.js";

const messageSchema = z
  .object({
    message: z.string().trim().min(1).max(5000),
    conversationId: z.string().refine(mongoose.isValidObjectId).optional(),
  })
  .strict();

function notFound(response, kind) {
  return response.status(404).json({
    success: false,
    error: {
      code: kind === "conversation" ? "CONVERSATION_NOT_FOUND" : "COURSE_NOT_FOUND",
      message: kind === "conversation" ? "Conversation not found" : "Course not found",
    },
  });
}

function providerErrorResponse(response, error) {
  if (!(error instanceof GeminiProviderError)) throw error;
  return response.status(error.statusCode).json({
    success: false,
    error: { code: error.code, message: error.message },
  });
}

function boundedContext(items, maxCharacters, field) {
  let remaining = maxCharacters;
  const result = [];
  for (const item of items) {
    if (remaining <= 0) break;
    const text = item[field].slice(0, remaining);
    result.push({ ...item, [field]: text });
    remaining -= text.length;
  }
  return result;
}

export function createChatRouter({
  config,
  UserModel,
  CourseModel = Course,
  TranscriptModel = Transcript,
  LessonStateModel = LessonState,
  ChatConversationModel = ChatConversation,
  tutor,
}) {
  const router = Router();
  const requireAuth = createAuthMiddleware({ config, UserModel });
  const verifyOrigin = requireTrustedOrigin(config);
  const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_request, response) {
      response.status(429).json({
        success: false,
        error: {
          code: "CHAT_RATE_LIMITED",
          message: "Too many tutor messages; try again later",
        },
      });
    },
  });

  router.get("/courses/:courseId", requireAuth, async (request, response) => {
    if (!mongoose.isValidObjectId(request.params.courseId)) {
      return notFound(response, "course");
    }
    const course = await CourseModel.findOne({
      _id: request.params.courseId,
      userId: request.authUser._id,
    }).select("_id");
    if (!course) return notFound(response, "course");
    const conversations = await ChatConversationModel.find({
      courseId: course._id,
      userId: request.authUser._id,
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select("title messageCount lastMessagePreview updatedAt");
    const summaries = conversations.map((item) => {
      const conversation = item.toObject ? item.toObject() : item;
      return {
        _id: String(conversation._id),
        title: conversation.title,
        messageCount: conversation.messageCount,
        lastMessagePreview: conversation.lastMessagePreview,
        updatedAt: conversation.updatedAt,
      };
    });
    return response.json({ success: true, data: { conversations: summaries } });
  });

  router.get(
    "/conversations/:conversationId",
    requireAuth,
    async (request, response) => {
      if (!mongoose.isValidObjectId(request.params.conversationId)) {
        return notFound(response, "conversation");
      }
      const conversation = await ChatConversationModel.findOne({
        _id: request.params.conversationId,
        userId: request.authUser._id,
      });
      if (!conversation) return notFound(response, "conversation");
      return response.json({ success: true, data: { conversation } });
    },
  );

  router.post(
    "/courses/:courseId/messages",
    verifyOrigin,
    requireAuth,
    chatLimiter,
    async (request, response) => {
      const parsed = messageSchema.safeParse(request.body);
      if (!parsed.success) {
        return response.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Provide a message of 1 to 5,000 characters",
          },
        });
      }
      if (!mongoose.isValidObjectId(request.params.courseId)) {
        return notFound(response, "course");
      }
      const course = await CourseModel.findOne({
        _id: request.params.courseId,
        userId: request.authUser._id,
      });
      if (!course) return notFound(response, "course");

      let conversation = null;
      if (parsed.data.conversationId) {
        conversation = await ChatConversationModel.findOne({
          _id: parsed.data.conversationId,
          courseId: course._id,
          userId: request.authUser._id,
        });
        if (!conversation) return notFound(response, "conversation");
      }

      const videoIds = course.videos.map((video) => video.videoId);
      const [savedTranscripts, savedStates] = await Promise.all([
        TranscriptModel.find({
          courseId: course._id,
          userId: request.authUser._id,
          videoId: { $in: videoIds },
        })
          .select("videoId text")
          .limit(30),
        LessonStateModel.find({
          courseId: course._id,
          userId: request.authUser._id,
          note: { $ne: "" },
        })
          .select("videoId note")
          .limit(100),
      ]);
      const videoById = new Map(
        course.videos.map((video) => [video.videoId, video]),
      );
      const transcripts = boundedContext(
        savedTranscripts.map((transcript) => ({
          videoId: transcript.videoId,
          title: videoById.get(transcript.videoId)?.title ?? "Course lesson",
          text: transcript.text,
        })),
        30000,
        "text",
      );
      const notes = boundedContext(
        savedStates
          .filter(
            (state) =>
              typeof state.note === "string" && state.note.trim().length > 0,
          )
          .map((state) => ({
            videoId: state.videoId,
            title: videoById.get(state.videoId)?.title ?? "Course lesson",
            text: state.note,
          })),
        12000,
        "text",
      );
      const history = (conversation?.messages ?? [])
        .slice(-12)
        .map((item) => ({ role: item.role, text: item.text }));

      let generated;
      try {
        generated = await tutor({
          course,
          transcripts,
          notes,
          history,
          message: parsed.data.message,
        });
      } catch (error) {
        return providerErrorResponse(response, error);
      }
      const parsedResponse = tutorResponseSchema.safeParse(generated);
      const citationIds = new Set(
        parsedResponse.success ? parsedResponse.data.citationVideoIds : [],
      );
      if (
        !parsedResponse.success ||
        [...citationIds].some((videoId) => !videoById.has(videoId))
      ) {
        return response.status(502).json({
          success: false,
          error: {
            code: "AI_INVALID_OUTPUT",
            message: "The AI provider returned an invalid tutor response",
          },
        });
      }

      const answer = parsedResponse.data.answer;
      const citations = [...citationIds].map((videoId) => ({
        videoId,
        title: videoById.get(videoId).title,
      }));
      const userMessage = { role: "user", text: parsed.data.message };
      const assistantMessage = { role: "assistant", text: answer, citations };

      if (!conversation) {
        conversation = await ChatConversationModel.create({
          userId: request.authUser._id,
          courseId: course._id,
          title: parsed.data.message.slice(0, 120),
          messageCount: 2,
          lastMessagePreview: answer.slice(0, 180),
          messages: [userMessage, assistantMessage],
        });
      } else {
        conversation.messages.push(userMessage, assistantMessage);
        conversation.messageCount += 2;
        conversation.lastMessagePreview = answer.slice(0, 180);
        if (conversation.messages.length > 40) {
          conversation.messages.splice(0, conversation.messages.length - 40);
        }
        await conversation.save();
      }

      return response.json({
        success: true,
        data: {
          conversation,
          answer: assistantMessage,
        },
      });
    },
  );

  return router;
}
