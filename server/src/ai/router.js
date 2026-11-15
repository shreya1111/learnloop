import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { createAuthMiddleware, requireTrustedOrigin } from "../auth/security.js";
import { Course } from "../models/Course.js";
import {
  generatedCourseStructureSchema,
  GeminiProviderError,
} from "./courseStructure.js";

function providerErrorResponse(response, error) {
  if (!(error instanceof GeminiProviderError)) {
    throw error;
  }

  return response.status(error.statusCode).json({
    success: false,
    error: { code: error.code, message: error.message },
  });
}

function invalidOutputResponse(response, message) {
  return response.status(502).json({
    success: false,
    error: { code: "AI_INVALID_OUTPUT", message },
  });
}

export function createAiRouter({
  config,
  UserModel,
  CourseModel = Course,
  courseStructureGenerator,
}) {
  const router = Router();
  const requireAuth = createAuthMiddleware({ config, UserModel });
  const verifyOrigin = requireTrustedOrigin(config);
  const generationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_request, response) {
      response.status(429).json({
        success: false,
        error: {
          code: "AI_RATE_LIMITED",
          message: "Too many course generation requests; try again later",
        },
      });
    },
  });

  router.post(
    "/courses/:courseId/structure",
    verifyOrigin,
    requireAuth,
    generationLimiter,
    async (request, response) => {
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
      if (course.videos.length === 0) {
        return response.status(409).json({
          success: false,
          error: {
            code: "COURSE_HAS_NO_VIDEOS",
            message: "Add videos to this course before generating its outline",
          },
        });
      }

      let generated;
      try {
        generated = await courseStructureGenerator({
          playlist: course.playlist,
          videos: course.videos,
        });
      } catch (error) {
        return providerErrorResponse(response, error);
      }

      const parsed = generatedCourseStructureSchema.safeParse(generated);
      if (!parsed.success) {
        return invalidOutputResponse(
          response,
          "The AI provider returned course data that did not match the required format",
        );
      }

      const orderedVideos = [...course.videos].sort(
        (left, right) => left.position - right.position,
      );
      const expectedVideoIds = orderedVideos.map((video) => video.videoId);
      const generatedVideoIds = parsed.data.chapters.flatMap(
        (chapter) => chapter.videoIds,
      );
      if (
        generatedVideoIds.length !== expectedVideoIds.length ||
        generatedVideoIds.some((videoId, index) => videoId !== expectedVideoIds[index])
      ) {
        return invalidOutputResponse(
          response,
          "The generated outline must include every playlist video exactly once and in order",
        );
      }

      const videosById = new Map(
        orderedVideos.map((video) => [video.videoId, video]),
      );
      course.title = parsed.data.title;
      course.description = parsed.data.description;
      course.learningObjectives = parsed.data.learningObjectives;
      course.difficulty = parsed.data.difficulty;
      course.prerequisites = parsed.data.prerequisites;
      course.estimatedDurationMinutes = parsed.data.estimatedDurationMinutes;
      course.chapters = parsed.data.chapters.map((chapter, position) => ({
        title: chapter.title,
        description: chapter.description,
        position,
        lessons: chapter.videoIds.map((videoId) => {
          const video = videosById.get(videoId);
          return {
            videoId: video.videoId,
            title: video.title,
            videoUrl: video.videoUrl,
            position: video.position,
            durationSeconds: video.durationSeconds,
          };
        }),
      }));
      course.status = "structured";
      await course.save();

      return response.json({ success: true, data: { course } });
    },
  );

  return router;
}
