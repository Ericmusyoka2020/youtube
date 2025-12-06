const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fetch = require("node-fetch"); // npm install node-fetch@2

const app = express();
app.use(cors());
app.use(express.json());

// Helper to run yt-dlp and get JSON
function getVideoInfo(videoUrl) {
    return new Promise((resolve, reject) => {
        const command = `yt-dlp --no-warnings --dump-json "${videoUrl}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error("YT-DLP Error:", stderr);
                return reject(stderr || error.message);
            }

            try {
                const info = JSON.parse(stdout);

                // Best video+audio single-file format (mp4)
                const bestVideo = info.formats
                    .filter(f => f.vcodec !== "none" && f.acodec !== "none" && f.ext === "mp4")
                    .sort((a, b) => b.height - a.height)[0];

                // Best audio-only single file (m4a)
                const bestAudio = info.formats
                    .filter(f => f.vcodec === "none" && f.ext === "m4a")
                    .sort((a, b) => b.abr - a.abr)[0];

                resolve({
                    title: info.title,
                    uploader: info.uploader || "Unknown",
                    videoUrl: bestVideo ? bestVideo.url : null,
                    audioUrl: bestAudio ? bestAudio.url : null
                });

            } catch (parseError) {
                console.error("YT-DLP JSON parse error:", parseError);
                reject("Failed to parse video info");
            }
        });
    });
}

// API: fetch video/audio info
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

// API: proxy download
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
