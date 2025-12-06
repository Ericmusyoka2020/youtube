const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fetch = require("node-fetch"); // npm install node-fetch@2

const app = express();
app.use(cors());
app.use(express.json());

// API: fetch video/audio info
app.get("/download-info", (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: "No URL provided" });

    const command = `yt-dlp --no-warnings --dump-json "${videoUrl}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) return res.status(500).json({ error: "Failed to fetch video info" });

        try {
            const info = JSON.parse(stdout);

            // Best video+audio
            const bestVideo = info.formats
                .filter(f => f.vcodec !== "none" && f.acodec !== "none")
                .sort((a,b) => b.height - a.height)[0];

            // Best audio only (single m4a file)
            const bestAudio = info.formats
                .filter(f => f.vcodec === "none" && f.ext === "m4a")
                .sort((a,b) => b.abr - a.abr)[0];

            res.json({
                title: info.title,
                uploader: info.uploader || "Unknown",
                videoUrl: bestVideo ? bestVideo.url : null,
                audioUrl: bestAudio ? bestAudio.url : null
            });

        } catch (err) {
            res.status(500).json({ error: "Parsing failed" });
        }
    });
});

// API: proxy download
app.get("/download-file", async (req, res) => {
    const { url, type, title } = req.query;
    if (!url || !type || !title) return res.status(400).send("Missing parameters");

    try {
        const response = await fetch(url);
        res.setHeader("Content-Disposition", `attachment; filename=${title}.${type}`);
        res.setHeader("Content-Type", type === "video" ? "video/mp4" : "audio/m4a");
        response.body.pipe(res);
    } catch (err) {
        res.status(500).send("Download failed");
    }
});

// Port for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
