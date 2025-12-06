const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // npm install node-fetch@2
const ytdlp = require("yt-dlp-exec"); // npm install yt-dlp-exec

const app = express();
app.use(cors());
app.use(express.json());

// Get video/audio info using yt-dlp-exec
async function getVideoInfo(videoUrl) {
    try {
        const info = await ytdlp(videoUrl, {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificates: true,
            format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4",
        });

        // Best video-only mp4
        const bestVideo = info.formats
            .filter(f => f.vcodec !== "none" && f.ext === "mp4")
            .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

        // Best audio-only m4a
        const bestAudio = info.formats
            .filter(f => f.vcodec === "none" && f.ext === "m4a")
            .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

        return {
            title: info.title,
            uploader: info.uploader || "Unknown",
            videoUrl: bestVideo ? bestVideo.url : null,
            audioUrl: bestAudio ? bestAudio.url : null
        };

    } catch (err) {
        console.error("YT-DLP Exec Error:", err);
        throw err.toString();
    }
}

// API: Fetch video/audio info
app.get("/download-info", async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: "No URL provided" });

    try {
        const data = await getVideoInfo(videoUrl);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.toString() });
    }
});

// API: Proxy download
app.get("/download-file", async (req, res) => {
    const { url, type, title } = req.query;
    if (!url || !type || !title) return res.status(400).send("Missing parameters");

    try {
        const response = await fetch(url);
        res.setHeader("Content-Disposition", `attachment; filename=${title.replace(/\s/g,'_')}.${type}`);
        res.setHeader("Content-Type", type === "video" ? "video/mp4" : "audio/m4a");
        response.body.pipe(res);
    } catch (err) {
        console.error("Download error:", err);
        res.status(500).send("Download failed: " + err.message);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
