import getTranscriptForVideo from "@/server-utils/get-transcript-for-video";
import getYouTubeVideoInfo from "@/server-utils/get-youtube-video-info";
import pg from "@/server-utils/pg";
import uniqid from "uniqid";

export default async function handler(req, res) {
    const { id } = req.query;

    const [existingVideo] = await pg.execute(`
        select id from youtube_videos where youtube_id = '${id}'
    `);

    if (existingVideo) {
        console.info(`Video ${id} already exists`);
        res.json({ id: id });
        return;
    }

    const { title, author, thumbUrl, url } = await getYouTubeVideoInfo(id);

    const { transcript, parts = [] } = await getTranscriptForVideo(id);

    const videoRecordId = uniqid();
    const [video] = await pg.execute(`
        insert into youtube_videos
        (id, slug, title, thumb_url, author, youtube_id)
        values
        ('${videoRecordId}', '${videoRecordId}', '${title}', '${thumbUrl}', '${author}', '${id}')
        returning id
    `);


    const transcriptRecordId = uniqid();
    const [fullTranscript] = await pg.execute(`
        insert into youtube_video_transcripts
        (id, youtube_id, text)
        values
        ('${transcriptRecordId}', '${id}', '${transcript}')
        returning text
    `);

    for (let i = 0; i < parts.length; i ++) {
        const { text, start, duration } = parts[i];
        const partRecordId = uniqid();
        await pg.execute(`
            insert into youtube_video_parts
            (id, youtube_id, text, start, duration)
            values
            ('${partRecordId}', '${id}', '${text}', ${+start}, ${+duration})
        `);
    }
    
    const payload = {
        id: id
    };

    res.json(payload);
}