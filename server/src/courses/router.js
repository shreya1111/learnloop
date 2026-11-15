import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { createAuthMiddleware, requireTrustedOrigin } from "../auth/security.js";
import { Course } from "../models/Course.js";
import { LessonState } from "../models/LessonState.js";
import { Transcript } from "../models/Transcript.js";

const transcriptBodySchema = z
  .object({ text: z.string().trim().min(1).max(250000) })
  .strict();

const lessonStateBodySchema = z
  .object({
    completed: z.boolean().optional(),
    note: z.string().trim().max(20000).optional(),
    bookmarked: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

function transcriptNotFound(response) {
  return response.status(404).json({
    success: false,
    error: { code: "VIDEO_NOT_FOUND", message: "Video not found in this course" },
  });
}

export function createCourseRouter({
  config,
  UserModel,
  CourseModel = Course,
  TranscriptModel = Transcript,
  LessonStateModel = LessonState,
  transcriptProvider,
}) {
  const router = Router();
  const requireAuth = createAuthMiddleware({ config, UserModel });
  const verifyOrigin = requireTrustedOrigin(config);

  router.get("/", requireAuth, async (request, response) => {
    const courses = await CourseModel.find({
      userId: request.authUser._id,
    })
      .sort({ updatedAt: -1 })
      .select("-videos");
    return response.json({ success: true, data: { courses } });
  });

  router.get("/:courseId", requireAuth, async (request, response) => {
    if (!mongoose.isValidObjectId(request.params.courseId)) {
      return response.status(404).json({
        success: false,
        error: { code: "COURSE_NOT_FOUND", message: "Course not found" },
      });
    }

    const course = await CourseModel.findOne({
      _id: request.params.courseId,
      userId: request.authUser._id,
    });
    if (!course) {
      return response.status(404).json({
        success: false,
        error: { code: "COURSE_NOT_FOUND", message: "Course not found" },
      });
    }
    return response.json({ success: true, data: { course } });
  });

  router.get("/:courseId/learning-state", requireAuth, async (request, response) => {
    if (!mongoose.isValidObjectId(request.params.courseId)) {
      return response.status(404).json({
        success: false,
        error: { code: "COURSE_NOT_FOUND", message: "Course not found" },
      });
    }

    const course = await CourseModel.findOne({
      _id: request.params.courseId,
      userId: request.authUser._id,
    });
    if (!course) {
      return response.status(404).json({
        success: false,
        error: { code: "COURSE_NOT_FOUND", message: "Course not found" },
      });
    }

    const savedStates = await LessonStateModel.find({
      userId: request.authUser._id,
      courseId: course._id,
    });
    const states = savedStates.map((state) => ({
      videoId: state.videoId,
      completed: state.completed,
      completedAt: state.completedAt,
      note: state.note,
      bookmarked: state.bookmarked,
      updatedAt: state.updatedAt,
    }));
    return response.json({ success: true, data: { states } });
  });

  router.put(
    "/:courseId/videos/:videoId/learning-state",
    verifyOrigin,
    requireAuth,
    async (request, response) => {
      const parsed = lessonStateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return response.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Provide at least one valid completion, note, or bookmark update",
          },
        });
      }
      if (!mongoose.isValidObjectId(request.params.courseId)) {
        return transcriptNotFound(response);
      }

      const course = await CourseModel.findOne({
        _id: request.params.courseId,
        userId: request.authUser._id,
      });
      const video = course?.videos.find(
        (item) => item.videoId === request.params.videoId,
      );
      if (!video) {
        return transcriptNotFound(response);
      }

      const fields = parsed.data;
      const update = {};
      if (fields.completed !== undefined) {
        update.completed = fields.completed;
        update.completedAt = fields.completed ? new Date() : null;
      }
      if (fields.note !== undefined) {
        update.note = fields.note;
      }
      if (fields.bookmarked !== undefined) {
        update.bookmarked = fields.bookmarked;
      }

      const state = await LessonStateModel.findOneAndUpdate(
        {
          userId: request.authUser._id,
          courseId: course._id,
          videoId: video.videoId,
        },
        { $set: update },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );
      return response.json({
        success: true,
        data: {
          state: {
            videoId: state.videoId,
            completed: state.completed,
            completedAt: state.completedAt,
            note: state.note,
            bookmarked: state.bookmarked,
            updatedAt: state.updatedAt,
          },
        },
      });
    },
  );

  router.get(
    "/:courseId/videos/:videoId/transcript",
    requireAuth,
    async (request, response) => {
      if (!mongoose.isValidObjectId(request.params.courseId)) {
        return transcriptNotFound(response);
      }
      const course = await CourseModel.findOne({
        _id: request.params.courseId,
        userId: request.authUser._id,
      });
      const video = course?.videos.find(
        (item) => item.videoId === request.params.videoId,
      );
      if (!video) {
        return transcriptNotFound(response);
      }

      const savedTranscript = await TranscriptModel.findOne({
        courseId: course._id,
        videoId: video.videoId,
      });
      const transcript = await transcriptProvider({
        videoId: video.videoId,
        userProvidedText: savedTranscript?.text,
      });
      return response.json({
        success: true,
        data: { videoId: video.videoId, ...transcript },
      });
    },
  );

  router.put(
    "/:courseId/videos/:videoId/transcript",
    verifyOrigin,
    requireAuth,
    async (request, response) => {
      const parsed = transcriptBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return response.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Provide transcript text between 1 and 250,000 characters",
          },
        });
      }
      if (!mongoose.isValidObjectId(request.params.courseId)) {
        return transcriptNotFound(response);
      }

      const course = await CourseModel.findOne({
        _id: request.params.courseId,
        userId: request.authUser._id,
      });
      const video = course?.videos.find(
        (item) => item.videoId === request.params.videoId,
      );
      if (!video) {
        return transcriptNotFound(response);
      }

      const transcript = await transcriptProvider({
        videoId: video.videoId,
        userProvidedText: parsed.data.text,
      });
      if (!transcript.available || transcript.source !== "user") {
        return response.status(503).json({
          success: false,
          error: {
            code: "TRANSCRIPT_UNAVAILABLE",
            message: "The transcript could not be saved",
          },
        });
      }

      await TranscriptModel.findOneAndUpdate(
        {
          courseId: course._id,
          userId: request.authUser._id,
          videoId: video.videoId,
        },
        { $set: { text: transcript.text, source: transcript.source } },
        { new: true, upsert: true, runValidators: true },
      );
      return response.json({
        success: true,
        data: { videoId: video.videoId, ...transcript },
      });
    },
  );

  return router;
}
