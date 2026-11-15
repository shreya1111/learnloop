import { z } from "zod";

const videoSchema = z
  .object({
    videoId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    title: z.string().min(1).max(500),
    description: z.string().max(5000),
    thumbnailUrl: z.string().max(2048),
    channelTitle: z.string().max(200),
    position: z.number().int().min(0),
    durationSeconds: z.number().int().min(0).nullable(),
    videoUrl: z.string().url().max(2048),
  })
  .strict();

export const playlistImportSchema = z
  .object({
    playlist: z
      .object({
        youtubePlaylistId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        title: z.string().min(1).max(200),
        description: z.string().max(5000),
        channelTitle: z.string().max(200),
        thumbnailUrl: z.string().max(2048),
        declaredVideoCount: z.number().int().min(0).max(500),
        videoCount: z.number().int().min(1).max(500),
        unavailableVideoCount: z.number().int().min(0).max(500),
      })
      .strict(),
    videos: z.array(videoSchema).min(1).max(500),
  })
  .strict()
  .refine((value) => value.playlist.videoCount === value.videos.length, {
    message: "Playlist video count does not match the imported videos",
  });
