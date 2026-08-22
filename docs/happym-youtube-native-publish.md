# Native YouTube publishing

Release `1.0.0-beta.3` exposes an organization-scoped M2M route:

`POST /public/v1/posts/youtube/publish`

The request identifies a connected YouTube account, a video by media ID or stored path, a title, an optional plain-text description, and the `yt-video` or `yt-shorts` format hint. A custom JPEG/PNG thumbnail can also be referenced by media ID or stored path. Every account and media lookup is constrained to the organization authenticated by the Public API key.

The route uses the existing YouTube resumable upload implementation and returns `videoId`, `url`, `formatHint`, and `thumbnailApplied`. The Shorts hint changes the returned canonical URL to `/shorts/{videoId}`; final Shorts classification remains a YouTube decision based on the uploaded media.

New YouTube connections request `youtube.upload` and `youtube.force-ssl`. Existing connections that predate this release must be reconnected before using custom thumbnails. Stable errors include `media_video_required`, `youtube_scope_insufficient`, `thumbnail_scope_missing`, and `thumbnail_rejected`. Secrets and Google response bodies are never returned or logged by this contract.

Media Studio renders can be MP4 or WebM. MP4 is streamed without conversion. WebM is normalized inside the appliance to a temporary MP4 using H.264 video and AAC when an audio track exists; the logical CRM media reference remains unchanged and the temporary file is always removed. Unsupported containers return `media_format_unsupported` (400), while conversion failures return `media_transcode_failed` (422). ffmpeg output, local paths and stack details are never exposed.
