// MPEG-1/MPEG-2 video decoder for the DICOM Viewer (public/dicom-viewer.html), built with FFmpeg by build.sh.
//
// A clip is opened from memory and split into pictures (packets) by FFmpeg's MPEG program stream, transport stream or
// raw video demuxer. A decoder can then be started at any keyframe and fed packets by index; each packet's index is
// carried through as the picture's pts, so the page can tell which picture came out (they come out in display order).

#include <stdint.h>
#include <string.h>
#include <emscripten/emscripten.h>
#include "libavformat/avformat.h"
#include "libavcodec/avcodec.h"
#include "libavutil/pixdesc.h"

typedef struct {
    const uint8_t *data;
    int size, pos;
} Source;

typedef struct {
    AVPacket **pkts;
    double *pts;          // presentation time of each packet from the container, or NAN
    int n, cap;
    AVCodecParameters *par;
    AVRational rate;
    uint8_t *seq;         // first sequence header (with its extensions), used when a decoder starts mid-clip
    int seq_size;
} Clip;

typedef struct {
    AVCodecContext *ctx;
    AVFrame *frame;
    AVPacket *pkt;
} Decoder;

static int read_source(void *opaque, uint8_t *buf, int size) {
    Source *s = opaque;
    int left = s->size - s->pos;
    if (left <= 0) return AVERROR_EOF;
    if (size > left) size = left;
    memcpy(buf, s->data + s->pos, size);
    s->pos += size;
    return size;
}

static int64_t seek_source(void *opaque, int64_t offset, int whence) {
    Source *s = opaque;
    if (whence == AVSEEK_SIZE) return s->size;
    int64_t to = whence == SEEK_CUR ? s->pos + offset : whence == SEEK_END ? s->size + offset : offset;
    if (to < 0 || to > s->size) return -1;
    s->pos = (int)to;
    return to;
}

// Sequence header (00 00 01 B3) and the extensions after it, up to the next GOP or picture start code.
static void keep_sequence_header(Clip *c, const uint8_t *d, int n) {
    for (int i = 0; i + 3 < n; i++) {
        if (d[i] || d[i + 1] || d[i + 2] != 1 || d[i + 3] != 0xB3) continue;
        int j = i + 4;
        for (; j + 3 < n; j++)
            if (!d[j] && !d[j + 1] && d[j + 2] == 1 && d[j + 3] != 0xB5 && d[j + 3] != 0xB3 && d[j + 3] != 0xB2) break;
        if (j + 3 >= n) j = n;
        c->seq = av_malloc(j - i + AV_INPUT_BUFFER_PADDING_SIZE);
        if (!c->seq) return;
        memcpy(c->seq, d + i, j - i);
        memset(c->seq + (j - i), 0, AV_INPUT_BUFFER_PADDING_SIZE);
        c->seq_size = j - i;
        return;
    }
}

EMSCRIPTEN_KEEPALIVE
void m2_close(Clip *c) {
    if (!c) return;
    for (int i = 0; i < c->n; i++) av_packet_free(&c->pkts[i]);
    av_free(c->pkts);
    av_free(c->pts);
    av_free(c->seq);
    avcodec_parameters_free(&c->par);
    av_free(c);
}

// Returns a clip, or NULL when no MPEG-1/2 video could be read. `data` stays owned by the caller.
EMSCRIPTEN_KEEPALIVE
Clip *m2_open(const uint8_t *data, int size) {
    Source src = { data, size, 0 };
    Clip *c = av_mallocz(sizeof(Clip));
    AVFormatContext *fmt = avformat_alloc_context();
    unsigned char *iobuf = av_malloc(65536);
    AVIOContext *io = avio_alloc_context(iobuf, 65536, 0, &src, read_source, NULL, seek_source);
    AVPacket *pkt = av_packet_alloc();
    int ok = 0;
    if (!c || !fmt || !iobuf || !io || !pkt) goto done;
    fmt->pb = io;
    fmt->flags |= AVFMT_FLAG_CUSTOM_IO;
    if (avformat_open_input(&fmt, NULL, NULL, NULL) < 0) { fmt = NULL; goto done; }
    if (avformat_find_stream_info(fmt, NULL) < 0) goto done;
    int vs = av_find_best_stream(fmt, AVMEDIA_TYPE_VIDEO, -1, -1, NULL, 0);
    if (vs < 0) goto done;
    AVStream *st = fmt->streams[vs];
    if (st->codecpar->codec_id != AV_CODEC_ID_MPEG2VIDEO && st->codecpar->codec_id != AV_CODEC_ID_MPEG1VIDEO) goto done;
    c->par = avcodec_parameters_alloc();
    if (!c->par || avcodec_parameters_copy(c->par, st->codecpar) < 0) goto done;
    c->rate = st->avg_frame_rate.num ? st->avg_frame_rate : st->r_frame_rate;
    // Seeking back to the start: find_stream_info may have consumed packets.
    if (av_seek_frame(fmt, -1, 0, AVSEEK_FLAG_BYTE | AVSEEK_FLAG_BACKWARD) < 0) {
        avio_seek(io, 0, SEEK_SET);
        avformat_flush(fmt);
    }
    while (av_read_frame(fmt, pkt) >= 0) {
        if (pkt->stream_index != vs || pkt->size <= 0) { av_packet_unref(pkt); continue; }
        if (c->n == c->cap) {
            int cap = c->cap ? c->cap * 2 : 256;
            AVPacket **p = av_realloc_array(c->pkts, cap, sizeof(*p));
            double *t = av_realloc_array(c->pts, cap, sizeof(*t));
            if (!p || !t) { av_free(p != c->pkts ? p : NULL); goto done; }
            c->pkts = p; c->pts = t; c->cap = cap;
        }
        if (!c->seq) keep_sequence_header(c, pkt->data, pkt->size);
        c->pts[c->n] = pkt->pts == AV_NOPTS_VALUE ? NAN : pkt->pts * av_q2d(st->time_base);
        c->pkts[c->n++] = av_packet_clone(pkt);
        av_packet_unref(pkt);
    }
    ok = c->n > 0;
done:
    av_packet_free(&pkt);
    if (fmt) avformat_close_input(&fmt);
    if (io) { av_freep(&io->buffer); avio_context_free(&io); } else av_free(iobuf);
    if (!ok) { m2_close(c); return NULL; }
    return c;
}

EMSCRIPTEN_KEEPALIVE int m2_count(Clip *c) { return c->n; }
EMSCRIPTEN_KEEPALIVE int m2_width(Clip *c) { return c->par->width; }
EMSCRIPTEN_KEEPALIVE int m2_height(Clip *c) { return c->par->height; }
EMSCRIPTEN_KEEPALIVE double m2_fps(Clip *c) { return c->rate.num && c->rate.den ? av_q2d(c->rate) : 0; }
EMSCRIPTEN_KEEPALIVE double m2_pts(Clip *c, int i) { return c->pts[i]; }
EMSCRIPTEN_KEEPALIVE uint8_t *m2_data(Clip *c, int i) { return c->pkts[i]->data; }
EMSCRIPTEN_KEEPALIVE int m2_size(Clip *c, int i) { return c->pkts[i]->size; }

EMSCRIPTEN_KEEPALIVE
void m2_dec_close(Decoder *d) {
    if (!d) return;
    avcodec_free_context(&d->ctx);
    av_frame_free(&d->frame);
    av_packet_free(&d->pkt);
    av_free(d);
}

EMSCRIPTEN_KEEPALIVE
Decoder *m2_dec_open(Clip *c) {
    Decoder *d = av_mallocz(sizeof(Decoder));
    const AVCodec *codec = avcodec_find_decoder(c->par->codec_id);
    if (!d || !codec) goto fail;
    d->ctx = avcodec_alloc_context3(codec);
    d->frame = av_frame_alloc();
    d->pkt = av_packet_alloc();
    if (!d->ctx || !d->frame || !d->pkt || avcodec_parameters_to_context(d->ctx, c->par) < 0) goto fail;
    // The decoder reads the sequence header from extradata, so it can start at a keyframe without one.
    if (!d->ctx->extradata && c->seq) {
        d->ctx->extradata = av_mallocz(c->seq_size + AV_INPUT_BUFFER_PADDING_SIZE);
        if (!d->ctx->extradata) goto fail;
        memcpy(d->ctx->extradata, c->seq, c->seq_size);
        d->ctx->extradata_size = c->seq_size;
    }
    d->ctx->thread_count = 1;
    if (avcodec_open2(d->ctx, codec, NULL) < 0) goto fail;
    return d;
fail:
    m2_dec_close(d);
    return NULL;
}

// Sends packet i (or the end of the clip when i < 0). Returns 0, or a negative FFmpeg error.
EMSCRIPTEN_KEEPALIVE
int m2_dec_send(Decoder *d, Clip *c, int i) {
    if (i < 0) return avcodec_send_packet(d->ctx, NULL);
    av_packet_unref(d->pkt);
    int r = av_packet_ref(d->pkt, c->pkts[i]);
    if (r < 0) return r;
    d->pkt->pts = d->pkt->dts = i;
    r = avcodec_send_packet(d->ctx, d->pkt);
    return r == AVERROR(EAGAIN) ? 0 : r;
}

// Returns 1 when a picture is ready (read it with the m2_frame_* functions), 0 when more input is needed.
EMSCRIPTEN_KEEPALIVE
int m2_dec_receive(Decoder *d) {
    av_frame_unref(d->frame);
    return avcodec_receive_frame(d->ctx, d->frame) >= 0;
}

EMSCRIPTEN_KEEPALIVE int m2_frame_width(Decoder *d) { return d->frame->width; }
EMSCRIPTEN_KEEPALIVE int m2_frame_height(Decoder *d) { return d->frame->height; }
EMSCRIPTEN_KEEPALIVE double m2_frame_pts(Decoder *d) { return d->frame->pts == AV_NOPTS_VALUE ? -1 : (double)d->frame->pts; }
EMSCRIPTEN_KEEPALIVE uint8_t *m2_frame_plane(Decoder *d, int p) { return d->frame->data[p]; }
EMSCRIPTEN_KEEPALIVE int m2_frame_stride(Decoder *d, int p) { return d->frame->linesize[p]; }
EMSCRIPTEN_KEEPALIVE int m2_frame_full_range(Decoder *d) { return d->frame->color_range == AVCOL_RANGE_JPEG; }
EMSCRIPTEN_KEEPALIVE int m2_frame_matrix(Decoder *d) { return d->frame->colorspace; }

// log2 of the horizontal and vertical chroma subsampling (1,1 for 4:2:0; 1,0 for 4:2:2; 0,0 for 4:4:4).
EMSCRIPTEN_KEEPALIVE
int m2_frame_chroma_shift(Decoder *d, int vertical) {
    const AVPixFmtDescriptor *pd = av_pix_fmt_desc_get(d->frame->format);
    return pd ? (vertical ? pd->log2_chroma_h : pd->log2_chroma_w) : 1;
}
