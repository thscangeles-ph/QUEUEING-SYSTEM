const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const HANDLE_HELP = "YouTube @handle links can't be embedded directly. On the channel page choose Share channel → Copy channel ID (it starts with UC) and paste that, or paste a playlist link.";

export type YouTubeEmbed = { kind: "channel" | "playlist" | "video"; src: string };

function embed(kind: YouTubeEmbed["kind"], path: string, extra = ""): YouTubeEmbed {
  return { kind, src: `https://www.youtube-nocookie.com/embed/${path}${path.includes("?") ? "&" : "?"}autoplay=1&mute=1&loop=1&controls=0&rel=0&playsinline=1&enablejsapi=1${extra}` };
}

/** Returns null for an empty value, an embed for a usable link, or an error explaining what to paste instead. */
export function parseYouTube(input: unknown): YouTubeEmbed | { error: string } | null {
  const text = String(input ?? "").trim();
  if (!text) return null;
  if (CHANNEL_ID.test(text)) return embed("channel", `videoseries?list=UU${text.slice(2)}`);
  if (/^(PL|UU|OL|FL|RD)[A-Za-z0-9_-]{8,}$/.test(text)) return embed("playlist", `videoseries?list=${text}`);
  if (VIDEO_ID.test(text)) return embed("video", text, `&playlist=${text}`);
  if (text.startsWith("@")) return { error: HANDLE_HELP };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { error: "That doesn't look like a YouTube link." };
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  if (!["youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) return { error: "Paste a link from youtube.com or youtu.be." };
  const parts = url.pathname.split("/").filter(Boolean);
  const list = url.searchParams.get("list");
  if (parts[0] === "channel" && CHANNEL_ID.test(parts[1] ?? "")) return embed("channel", `videoseries?list=UU${parts[1].slice(2)}`);
  if (parts[0]?.startsWith("@") || parts[0] === "c" || parts[0] === "user") return { error: HANDLE_HELP };
  if (list && LIST_ID.test(list)) return embed("playlist", `videoseries?list=${list}`);
  const video = host === "youtu.be" ? parts[0] : parts[0] === "watch" ? url.searchParams.get("v") : ["embed", "shorts", "live", "v"].includes(parts[0] ?? "") ? parts[1] : null;
  if (video && VIDEO_ID.test(video)) return embed("video", video, `&playlist=${video}`);
  return { error: "Paste a YouTube video, playlist or channel link." };
}

/** One entry of the lobby TV's playlist: a YouTube link, or a picture shown for a few seconds (a slideshow). */
export type TvMedia = { type: "youtube"; link: string } | { type: "picture"; src: string; name?: string };

export const MAX_TV_MEDIA = 30;
/** A picture uploaded to the queue server (see app/api/media). */
const UPLOADED_PICTURE = /^\/api\/media\/[a-f0-9]{24}$/;

/** Null for a picture the TV can show (uploaded, or an https link), otherwise what is wrong with it. */
export function pictureError(src: string): string | null {
  if (UPLOADED_PICTURE.test(src)) return null;
  try {
    if (new URL(src).protocol === "https:") return null;
  } catch {
    /* not a link */
  }
  return "Upload the picture, or paste a picture link starting with https://.";
}

const fromYouTubeField = (youtube: unknown): TvMedia[] => String(youtube ?? "").split(/\s*\n\s*/).filter(Boolean).map((link) => ({ type: "youtube", link }));

/** The TV's playlist, in order; settings saved before playlists existed have a single YouTube link instead. */
export function tvMediaOf(settings: { tvMedia?: TvMedia[]; youtube?: string } | null | undefined): TvMedia[] {
  return Array.isArray(settings?.tvMedia) ? settings.tvMedia : fromYouTubeField(settings?.youtube);
}

/** Checks the TV playlist from a settings form; returns the tidied list, or an error naming the bad entry. */
export function cleanTvMedia(input: { tvMedia?: unknown; youtube?: unknown }): TvMedia[] | string {
  const raw = (Array.isArray(input.tvMedia) ? input.tvMedia : fromYouTubeField(input.youtube)) as (Record<string, unknown> | null)[];
  const list: TvMedia[] = [];
  for (const [index, item] of raw.entries()) {
    if (item?.type === "picture") {
      const src = String(item.src ?? "").trim().slice(0, 500);
      if (!src) continue;
      const error = pictureError(src);
      if (error) return `TV playlist item ${index + 1}: ${error}`;
      list.push({ type: "picture", src, name: String(item.name ?? "").trim().slice(0, 80) || undefined });
    } else {
      const link = String(item?.link ?? "").trim().slice(0, 300);
      if (!link) continue;
      const video = parseYouTube(link);
      if (video && "error" in video) return `TV playlist item ${index + 1}: ${video.error}`;
      list.push({ type: "youtube", link });
    }
  }
  if (list.length > MAX_TV_MEDIA) return `The TV playlist can have up to ${MAX_TV_MEDIA} videos and pictures.`;
  return list;
}
