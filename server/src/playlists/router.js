import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createAuthMiddleware, requireTrustedOrigin } from "../auth/security.js";
import { Course } from "../models/Course.js";
import {
  canonicalPlaylistUrl,
  extractPlaylistId,
  PlaylistUrlError,
} from "../integrations/youtube/playlistUrl.js";
import { playlistImportSchema } from "../integrations/youtube/schemas.js";
import { YouTubeApiError } from "../integrations/youtube/client.js";

const importBodySchema = z
  .object({ playlistUrl: z.string().trim().url().max(2048) })
  .strict();

function validationError(response, issues) {
  return response.status(400).json({
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Check the submitted fields",
      details: issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    },
  });
}

function youtubeErrorResponse(response, error) {
  return response.status(error.statusCode).json({
    success: false,
    error: { code: error.code, message: error.message },
  });
}

export function createPlaylistRouter({
  config,
  UserModel,
  CourseModel = Course,
  youtubeClient,
}) {
  const router = Router();
  const requireAuth = createAuthMiddleware({ config, UserModel });
  const verifyOrigin = requireTrustedOrigin(config);
  const importLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_request, response) {
      response.status(429).json({
        success: false,
        error: {
          code: "IMPORT_RATE_LIMITED",
          message: "Too many playlist imports; try again later",
        },
      });
    },
  });

  router.post(
    "/import",
    verifyOrigin,
    requireAuth,
    importLimiter,
    async (request, response) => {
      const parsed = importBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return validationError(response, parsed.error.issues);
      }

      let playlistId;
      try {
        playlistId = extractPlaylistId(parsed.data.playlistUrl);
      } catch (error) {
        if (error instanceof PlaylistUrlError) {
          return response.status(400).json({
            success: false,
            error: { code: "INVALID_PLAYLIST_URL", message: error.message },
          });
        }
        throw error;
      }

      const existingCourse = await CourseModel.findOne({
        userId: request.authUser._id,
        "playlist.youtubePlaylistId": playlistId,
      });
      if (existingCourse) {
        return response.status(409).json({
          success: false,
          error: {
            code: "PLAYLIST_ALREADY_IMPORTED",
            message: "This playlist is already in your courses",
            courseId: existingCourse._id.toString(),
          },
        });
      }

      let upstream;
      try {
        upstream = await youtubeClient.fetchPlaylist(playlistId);
      } catch (error) {
        if (error instanceof YouTubeApiError) {
          return youtubeErrorResponse(response, error);
        }
        throw error;
      }

      const validated = playlistImportSchema.safeParse(upstream);
      if (!validated.success) {
        return youtubeErrorResponse(
          response,
          new YouTubeApiError(
            502,
            "YOUTUBE_INVALID_RESPONSE",
            "YouTube returned playlist data that could not be imported",
          ),
        );
      }

      const { playlist, videos } = validated.data;
      // Playlist thumbnails are often a low-resolution placeholder; the first
      // video's image is a reliable cover when one is available.
      const coverThumbnailUrl =
        videos[0]?.thumbnailUrl || playlist.thumbnailUrl;
      const allDurationsAvailable = videos.every(
        (video) => video.durationSeconds !== null,
      );
      const estimatedDurationSeconds = allDurationsAvailable
        ? videos.reduce((total, video) => total + video.durationSeconds, 0)
        : null;

      let course;
      try {
        course = await CourseModel.create({
          userId: request.authUser._id,
          title: playlist.title,
          description: playlist.description,
          status: "imported",
          playlist: {
            youtubePlaylistId: playlistId,
            sourceUrl: canonicalPlaylistUrl(playlistId),
            title: playlist.title,
            description: playlist.description,
            channelTitle: playlist.channelTitle,
            thumbnailUrl: coverThumbnailUrl,
            videoCount: playlist.videoCount,
            unavailableVideoCount: playlist.unavailableVideoCount,
            importedAt: new Date(),
          },
          videos,
          estimatedDurationSeconds,
        });
      } catch (error) {
        if (error.code === 11000) {
          return response.status(409).json({
            success: false,
            error: {
              code: "PLAYLIST_ALREADY_IMPORTED",
              message: "This playlist is already in your courses",
            },
          });
        }
        throw error;
      }

      return response.status(201).json({
        success: true,
        data: { course },
      });
    },
  );

  return router;
}
