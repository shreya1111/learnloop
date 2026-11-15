import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { createAuthRouter } from "./auth/router.js";
import { createAiRouter } from "./ai/router.js";
import { createGeminiCourseStructureGenerator } from "./ai/courseStructure.js";
import { createGeminiQuizGenerator } from "./ai/quiz.js";
import { createGeminiStudyPlanGenerator } from "./ai/studyPlan.js";
import { createGeminiTutor } from "./ai/tutor.js";
import { createCourseRouter } from "./courses/router.js";
import { Course } from "./models/Course.js";
import { LessonState } from "./models/LessonState.js";
import { StudyPlan } from "./models/StudyPlan.js";
import { Quiz } from "./models/Quiz.js";
import { QuizAttempt } from "./models/QuizAttempt.js";
import { LearningActivity } from "./models/LearningActivity.js";
import { ChatConversation } from "./models/ChatConversation.js";
import { Transcript } from "./models/Transcript.js";
import { User } from "./models/User.js";
import { createYouTubeDataClient } from "./integrations/youtube/client.js";
import { createTranscriptProvider } from "./integrations/transcripts/provider.js";
import { createPlaylistRouter } from "./playlists/router.js";
import { createUserRouter } from "./users/router.js";
import { createStudyPlanRouter } from "./studyPlans/router.js";
import { createQuizRouter } from "./quizzes/router.js";
import { createProgressRouter } from "./progress/router.js";
import { createChatRouter } from "./chat/router.js";

export function createApp({
  config,
  UserModel = User,
  CourseModel = Course,
  TranscriptModel = Transcript,
  LessonStateModel = LessonState,
  StudyPlanModel = StudyPlan,
  QuizModel = Quiz,
  QuizAttemptModel = QuizAttempt,
  LearningActivityModel = LearningActivity,
  ChatConversationModel = ChatConversation,
  progressClock = () => new Date(),
  courseStructureGenerator = createGeminiCourseStructureGenerator({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  }),
  studyPlanGenerator = createGeminiStudyPlanGenerator({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  }),
  quizGenerator = createGeminiQuizGenerator({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  }),
  tutor = createGeminiTutor({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
  }),
  youtubeClient = createYouTubeDataClient({ apiKey: config.youtubeApiKey }),
  transcriptProvider = createTranscriptProvider(),
}) {
  const app = express();

  if (config.trustProxy > 0) {
    app.set("trust proxy", config.trustProxy);
  }
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "frame-src": ["'self'", "https://www.youtube-nocookie.com"],
          "img-src": ["'self'", "data:", "https:"],
        },
      },
    }),
  );
  app.use(
    cors({ origin: config.clientOrigins ?? config.clientOrigin, credentials: true }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler(_request, response) {
        response.status(429).json({
          success: false,
          error: {
            code: "API_RATE_LIMITED",
            message: "Too many requests; try again later",
          },
        });
      },
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_request, response) => {
    const databaseConnected = mongoose.connection.readyState === 1;
    const data = {
      status: databaseConnected ? "ok" : "degraded",
      service: "learnloop-api",
      database: databaseConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };

    if (!databaseConnected) {
      return response.status(503).json({
        success: false,
        data,
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "The database connection is unavailable",
        },
      });
    }

    return response.json({
      success: true,
      data,
    });
  });

  app.use("/api/auth", createAuthRouter({ config, UserModel }));
  app.use("/api/users", createUserRouter({ config, UserModel }));
  app.use(
    "/api/ai",
    createAiRouter({
      config,
      UserModel,
      CourseModel,
      courseStructureGenerator,
    }),
  );
  app.use(
    "/api/playlists",
    createPlaylistRouter({ config, UserModel, CourseModel, youtubeClient }),
  );
  app.use(
    "/api/courses",
    createCourseRouter({
      config,
      UserModel,
      CourseModel,
      TranscriptModel,
      LessonStateModel,
      transcriptProvider,
    }),
  );
  app.use(
    "/api/study-plans",
    createStudyPlanRouter({
      config,
      UserModel,
      CourseModel,
      StudyPlanModel,
      studyPlanGenerator,
    }),
  );
  app.use(
    "/api/quizzes",
    createQuizRouter({
      config,
      UserModel,
      CourseModel,
      TranscriptModel,
      QuizModel,
      QuizAttemptModel,
      quizGenerator,
    }),
  );
  app.use(
    "/api/progress",
    createProgressRouter({
      config,
      UserModel,
      CourseModel,
      LessonStateModel,
      QuizAttemptModel,
      LearningActivityModel,
      clock: progressClock,
    }),
  );
  app.use(
    "/api/chat",
    createChatRouter({
      config,
      UserModel,
      CourseModel,
      TranscriptModel,
      LessonStateModel,
      ChatConversationModel,
      tutor,
    }),
  );

  app.use((_request, response) => {
    response.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  app.use((error, _request, response, _next) => {
    if (error.type === "entity.parse.failed") {
      return response.status(400).json({
        success: false,
        error: { code: "INVALID_JSON", message: "Request body must be valid JSON" },
      });
    }

    if (error.type === "entity.too.large") {
      return response.status(413).json({
        success: false,
        error: { code: "REQUEST_TOO_LARGE", message: "Request body is too large" },
      });
    }

    if (error.name === "ValidationError") {
      return response.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Submitted data is invalid" },
      });
    }

    console.error("API request failed", error);
    return response.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    });
  });

  return app;
}
