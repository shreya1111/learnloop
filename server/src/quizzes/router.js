import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { createAuthMiddleware, requireTrustedOrigin } from "../auth/security.js";
import { GeminiProviderError } from "../ai/geminiJson.js";
import { generatedQuizSchema } from "../ai/quiz.js";
import { Course } from "../models/Course.js";
import { Quiz } from "../models/Quiz.js";
import { QuizAttempt } from "../models/QuizAttempt.js";
import { Transcript } from "../models/Transcript.js";

const quizRequestSchema = z
  .object({
    mode: z.enum(["quiz", "placement"]).default("quiz"),
    questionCount: z.number().int().min(5).max(20).default(10),
    chapterPosition: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(
    (value) => value.mode !== "placement" || value.chapterPosition === undefined,
    { message: "Placement tests cover the full course" },
  );

const attemptRequestSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            questionId: z.string().min(1).max(64),
            answer: z.string().trim().max(1000),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

function notFound(response, kind) {
  const isQuiz = kind === "quiz";
  return response.status(404).json({
    success: false,
    error: {
      code: isQuiz ? "QUIZ_NOT_FOUND" : "COURSE_NOT_FOUND",
      message: isQuiz ? "Quiz not found" : "Course not found",
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

function invalidOutputResponse(response, message) {
  return response.status(502).json({
    success: false,
    error: { code: "AI_INVALID_OUTPUT", message },
  });
}

function asId(value) {
  return String(value?._id ?? value);
}

function publicQuiz(quiz, { revealAnswers = false } = {}) {
  const result = quiz.toObject ? quiz.toObject() : quiz;
  return {
    _id: asId(result._id),
    courseId: asId(result.courseId),
    title: result.title,
    mode: result.mode,
    description: result.description,
    createdAt: result.createdAt,
    questions: result.questions.map((question) => ({
      _id: asId(question._id),
      topic: question.topic,
      lessonVideoIds: question.lessonVideoIds,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      difficulty: question.difficulty,
      ...(revealAnswers
        ? {
            correctAnswer: question.correctAnswer,
            acceptedAnswers: question.acceptedAnswers,
            explanation: question.explanation,
          }
        : {}),
    })),
  };
}

export function normalizeGeneratedQuiz(generated) {
  if (!generated || !Array.isArray(generated.questions)) {
    return generated;
  }
  return {
    ...generated,
    // Providers regularly echo the correct choice into acceptedAnswers; a
    // choice question can only accept the option that was selected.
    questions: generated.questions.map((question) =>
      question?.type === "multiple-choice" || question?.type === "true-false"
        ? { ...question, acceptedAnswers: [] }
        : question,
    ),
  };
}

export function validateGeneratedQuiz(
  generated,
  course,
  { mode, questionCount, chapterPosition },
) {
  const parsed = generatedQuizSchema.safeParse(generated);
  if (!parsed.success || parsed.data.questions.length !== questionCount) {
    return {
      success: false,
      message: "The AI provider returned an invalid number or format of questions",
    };
  }

  const targetChapters = [...course.chapters]
    .sort((left, right) => left.position - right.position)
    .filter(
      (chapter) =>
        chapterPosition === undefined || chapter.position === chapterPosition,
    );
  const chaptersByTitle = new Map(
    targetChapters.map((chapter) => [chapter.title, chapter]),
  );
  const coveredTopics = new Set();
  const promptSignatures = new Set();

  for (const question of parsed.data.questions) {
    const chapter = chaptersByTitle.get(question.topic);
    if (
      !chapter ||
      question.lessonVideoIds.some(
        (videoId) =>
          !chapter.lessons.some((lesson) => lesson.videoId === videoId),
      )
    ) {
      return {
        success: false,
        message: "A question references a topic or lesson outside this quiz",
      };
    }

    coveredTopics.add(question.topic);
    const signature = question.prompt.toLocaleLowerCase().replace(/\s+/g, " ");
    if (promptSignatures.has(signature)) {
      return { success: false, message: "The quiz contains duplicate questions" };
    }
    promptSignatures.add(signature);

    if (question.type === "multiple-choice") {
      if (
        question.options.length !== 4 ||
        new Set(question.options).size !== question.options.length ||
        !question.options.includes(question.correctAnswer) ||
        question.acceptedAnswers.length !== 0
      ) {
        return {
          success: false,
          message: "A multiple-choice question has invalid options or answer",
        };
      }
    } else if (question.type === "true-false") {
      if (
        question.options.length !== 2 ||
        new Set(question.options).size !== 2 ||
        !["True", "False"].every((option) => question.options.includes(option)) ||
        !question.options.includes(question.correctAnswer) ||
        question.acceptedAnswers.length !== 0
      ) {
        return {
          success: false,
          message: "A true-false question has invalid options or answer",
        };
      }
    } else if (question.options.length !== 0) {
      return {
        success: false,
        message: "A short-answer question cannot include choices",
      };
    }
  }

  if (
    mode === "placement" &&
    targetChapters.some((chapter) => !coveredTopics.has(chapter.title))
  ) {
    return {
      success: false,
      message: "A placement test must assess every course chapter",
    };
  }

  return { success: true, data: parsed.data };
}

function normalizeAnswer(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function recommendationFor(masteryPercent) {
  if (masteryPercent >= 80) return "skip";
  if (masteryPercent >= 50) return "revise";
  return "deeper-learning";
}

export function gradeQuiz(quiz, answers) {
  const answersById = new Map(
    answers.map(({ questionId, answer }) => [questionId, answer]),
  );
  const questionResults = quiz.questions.map((question) => {
    const id = asId(question._id);
    const answer = answersById.get(id);
    const candidates = [
      question.correctAnswer,
      ...(question.acceptedAnswers ?? []),
    ].map(normalizeAnswer);
    return {
      questionId: id,
      answer,
      isCorrect: answer !== undefined && candidates.includes(normalizeAnswer(answer)),
    };
  });
  const topicCounts = new Map();
  quiz.questions.forEach((question, index) => {
    const count = topicCounts.get(question.topic) ?? { correct: 0, total: 0 };
    count.total += 1;
    if (questionResults[index].isCorrect) count.correct += 1;
    topicCounts.set(question.topic, count);
  });

  const topicResults = [...topicCounts].map(([topic, result]) => {
    const masteryPercent = Math.round((result.correct / result.total) * 100);
    return {
      topic,
      ...result,
      masteryPercent,
      recommendation: recommendationFor(masteryPercent),
    };
  });
  const correctCount = questionResults.filter(
    (result) => result.isCorrect,
  ).length;

  return {
    correctCount,
    totalQuestions: quiz.questions.length,
    scorePercent: Math.round((correctCount / quiz.questions.length) * 100),
    questionResults,
    topicResults,
  };
}

export function createQuizRouter({
  config,
  UserModel,
  CourseModel = Course,
  TranscriptModel = Transcript,
  QuizModel = Quiz,
  QuizAttemptModel = QuizAttempt,
  quizGenerator,
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
          message: "Too many quiz generation requests; try again later",
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
    });
    if (!course) return notFound(response, "course");

    const quizzes = await QuizModel.find({
      userId: request.authUser._id,
      courseId: course._id,
    }).sort({ createdAt: -1 });
    const attempts = await QuizAttemptModel.find({
      userId: request.authUser._id,
      courseId: course._id,
    })
      .sort({ submittedAt: -1 })
      .limit(20);
    return response.json({
      success: true,
      data: {
        quizzes: quizzes.map((quiz) => publicQuiz(quiz)),
        attempts: attempts.map((attempt) => {
          const result = attempt.toObject ? attempt.toObject() : attempt;
          return {
            _id: asId(result._id),
            quizId: asId(result.quizId),
            scorePercent: result.scorePercent,
            correctCount: result.correctCount,
            totalQuestions: result.totalQuestions,
            topicResults: result.topicResults,
            submittedAt: result.submittedAt,
          };
        }),
      },
    });
  });

  router.post(
    "/courses/:courseId",
    verifyOrigin,
    requireAuth,
    generationLimiter,
    async (request, response) => {
      const parsedRequest = quizRequestSchema.safeParse(request.body ?? {});
      if (!parsedRequest.success) {
        return response.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Check the quiz mode, question count, and chapter",
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
      if (course.status !== "structured" || course.chapters.length === 0) {
        return response.status(409).json({
          success: false,
          error: {
            code: "COURSE_NOT_STRUCTURED",
            message: "Generate a course outline before creating a quiz",
          },
        });
      }

      const { mode, questionCount, chapterPosition } = parsedRequest.data;
      const chapters = [...course.chapters].sort(
        (left, right) => left.position - right.position,
      );
      if (
        (chapterPosition !== undefined &&
          !chapters.some((chapter) => chapter.position === chapterPosition)) ||
        (mode === "placement" && chapters.length > questionCount)
      ) {
        return response.status(422).json({
          success: false,
          error: {
            code: "INVALID_QUIZ_SCOPE",
            message:
              mode === "placement"
                ? "Question count must be at least the number of course chapters"
                : "Select a chapter in this course",
          },
        });
      }

      const transcriptVideoIds = chapters
        .filter(
          (chapter) =>
            chapterPosition === undefined ||
            chapter.position === chapterPosition,
        )
        .flatMap((chapter) => chapter.lessons.map((lesson) => lesson.videoId));
      const transcripts = await TranscriptModel.find({
        userId: request.authUser._id,
        courseId: course._id,
        videoId: { $in: transcriptVideoIds },
      })
        .select("videoId text")
        .limit(50);
      let generated;
      try {
        generated = await quizGenerator({
          course,
          transcripts,
          mode,
          questionCount,
          chapterPosition,
        });
      } catch (error) {
        return providerErrorResponse(response, error);
      }

      const validated = validateGeneratedQuiz(
        normalizeGeneratedQuiz(generated),
        course,
        {
          mode,
          questionCount,
          chapterPosition,
        },
      );
      if (!validated.success) {
        return invalidOutputResponse(response, validated.message);
      }

      const quiz = await QuizModel.create({
        userId: request.authUser._id,
        courseId: course._id,
        mode,
        title: validated.data.title,
        description: validated.data.description,
        questions: validated.data.questions,
      });
      return response.status(201).json({
        success: true,
        data: { quiz: publicQuiz(quiz) },
      });
    },
  );

  router.get("/:quizId", requireAuth, async (request, response) => {
    if (!mongoose.isValidObjectId(request.params.quizId)) {
      return notFound(response, "quiz");
    }
    const quiz = await QuizModel.findOne({
      _id: request.params.quizId,
      userId: request.authUser._id,
    });
    if (!quiz) return notFound(response, "quiz");
    return response.json({
      success: true,
      data: { quiz: publicQuiz(quiz) },
    });
  });

  router.post(
    "/:quizId/attempts",
    verifyOrigin,
    requireAuth,
    async (request, response) => {
      const parsedAnswers = attemptRequestSchema.safeParse(request.body);
      if (!parsedAnswers.success) {
        return response.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Submit an answer for each question",
          },
        });
      }
      if (!mongoose.isValidObjectId(request.params.quizId)) {
        return notFound(response, "quiz");
      }
      const quiz = await QuizModel.findOne({
        _id: request.params.quizId,
        userId: request.authUser._id,
      });
      if (!quiz) return notFound(response, "quiz");

      const { answers } = parsedAnswers.data;
      const questionIds = new Set(quiz.questions.map((item) => asId(item._id)));
      const submittedIds = new Set(answers.map((answer) => answer.questionId));
      if (
        answers.length !== quiz.questions.length ||
        submittedIds.size !== answers.length ||
        answers.some((answer) => !questionIds.has(answer.questionId))
      ) {
        return response.status(400).json({
          success: false,
          error: {
            code: "INCOMPLETE_ATTEMPT",
            message: "Submit exactly one answer for every quiz question",
          },
        });
      }

      const graded = gradeQuiz(quiz, answers);
      const attempt = await QuizAttemptModel.create({
        userId: request.authUser._id,
        courseId: quiz.courseId,
        quizId: quiz._id,
        ...graded,
      });
      const resultsById = new Map(
        graded.questionResults.map((result) => [result.questionId, result]),
      );
      const results = quiz.questions.map((question) => ({
        questionId: asId(question._id),
        topic: question.topic,
        prompt: question.prompt,
        type: question.type,
        answer: resultsById.get(asId(question._id)).answer,
        isCorrect: resultsById.get(asId(question._id)).isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      }));
      return response.status(201).json({
        success: true,
        data: {
          attempt: {
            _id: asId(attempt._id),
            ...graded,
            submittedAt: attempt.submittedAt,
          },
          results,
        },
      });
    },
  );

  return router;
}
