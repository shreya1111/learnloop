import mongoose from "mongoose";

export const playlistSchema = new mongoose.Schema(
  {
    youtubePlaylistId: {
      type: String,
      required: true,
      maxlength: 128,
    },
    sourceUrl: {
      type: String,
      required: true,
      maxlength: 2048,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    channelTitle: {
      type: String,
      default: "",
      maxlength: 200,
    },
    thumbnailUrl: {
      type: String,
      default: "",
      maxlength: 2048,
    },
    videoCount: {
      type: Number,
      required: true,
      min: 0,
    },
    unavailableVideoCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    importedAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false },
);
