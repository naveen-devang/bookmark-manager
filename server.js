const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
  });
});

// API Routes
// Get all bookmarks
app.get("/api/bookmarks", async (req, res) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    // Fetch bookmarks with pagination
    const { data, error, count } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      bookmarks: data,
      total: count,
      page: page,
      limit: limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    res.status(500).json({ message: "Failed to fetch bookmarks" });
  }
});

// Add a new bookmark
app.post("/api/bookmarks", async (req, res) => {
  try {
    const { url, title, description, image_url, tags } = req.body;

    if (!url) {
      return res.status(400).json({ message: "URL is required" });
    }

    // Create bookmark object
    const bookmark = {
      url,
      title: title || "Untitled",
      description: description || "",
      image_url: image_url || null,
      site_name: new URL(url).hostname,
      tags: tags || [],
    };

    // Save bookmark to Supabase
    const { data, error } = await supabase
      .from("bookmarks")
      .insert([bookmark])
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (error) {
    console.error("Error adding bookmark:", error);
    res.status(500).json({ message: "Failed to add bookmark" });
  }
});

// Fetch metadata without saving
app.post("/api/fetch-metadata", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: "URL is required" });
    }

    // Fetch metadata from the URL
    const metadata = await fetchUrlMetadata(url);

    res.json(metadata);
  } catch (error) {
    console.error("Error fetching metadata:", error);
    res.status(500).json({ message: "Failed to fetch metadata" });
  }
});

// Update a bookmark
app.put("/api/bookmarks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, tags } = req.body;

    const { data, error } = await supabase
      .from("bookmarks")
      .update({ title, description, tags })
      .eq("id", id)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ message: "Bookmark not found" });
    }

    res.json(data[0]);
  } catch (error) {
    console.error("Error updating bookmark:", error);
    res.status(500).json({ message: "Failed to update bookmark" });
  }
});

// Delete a bookmark
app.delete("/api/bookmarks/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from("bookmarks").delete().eq("id", id);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting bookmark:", error);
    res.status(500).json({ message: "Failed to delete bookmark" });
  }
});

// Helper function to fetch metadata from URL
async function fetchUrlMetadata(url) {
  try {
    // Check for unsupported protocols
    const urlObj = new URL(url);
    const protocol = urlObj.protocol.toLowerCase();

    // List of protocols that cannot be fetched
    const unsupportedProtocols = [
      "chrome:",
      "chrome-extension:",
      "file:",
      "about:",
      "data:",
      "view-source:",
    ];

    if (unsupportedProtocols.some((p) => protocol.startsWith(p))) {
      // Return basic metadata for browser-specific URLs
      return {
        title: url.includes("://") ? url.split("://")[1] : url,
        description:
          "This is a browser-specific page that cannot be previewed.",
        image: null,
        siteName: protocol.replace(":", ""),
      };
    }

    // Special handling for known social media platforms
    if (url.includes("twitter.com") || url.includes("x.com")) {
      return await fetchTwitterMetadata(url);
    } else if (url.includes("instagram.com")) {
      return await fetchInstagramMetadata(url);
    } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return await fetchYoutubeMetadata(url);
    } else {
      // Generic OG metadata extraction
      return await fetchGenericMetadata(url);
    }
  } catch (error) {
    console.error("Error fetching URL metadata:", error);

    // Basic fallback for any URL
    let siteName;
    try {
      siteName = new URL(url).hostname;
    } catch (e) {
      siteName = "Unknown";
    }

    return {
      title: "Unknown Title",
      description: "No description available",
      image: null,
      siteName: siteName,
    };
  }
}

// Fetch generic Open Graph metadata
async function fetchGenericMetadata(url) {
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BookmarkBot/1.0)",
    },
  });

  const $ = cheerio.load(response.data);

  const metadata = {
    title:
      $('meta[property="og:title"]').attr("content") ||
      $("title").text() ||
      "Unknown Title",
    description:
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "No description available",
    image:
      $('meta[property="og:image"]').attr("content") ||
      $('meta[property="og:image:url"]').attr("content") ||
      null,
    siteName:
      $('meta[property="og:site_name"]').attr("content") ||
      new URL(url).hostname,
  };

  return metadata;
}

// Fetch Twitter metadata using Twitter Card and oEmbed
async function fetchTwitterMetadata(url) {
  // First try to get Twitter Card metadata
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookmarkBot/1.0)",
      },
    });

    const $ = cheerio.load(response.data);

    const metadata = {
      title:
        $('meta[name="twitter:title"]').attr("content") ||
        $('meta[property="og:title"]').attr("content") ||
        "Twitter Post",
      description:
        $('meta[name="twitter:description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        "No description available",
      image:
        $('meta[name="twitter:image"]').attr("content") ||
        $('meta[property="og:image"]').attr("content") ||
        null,
      siteName: "Twitter",
    };

    return metadata;
  } catch (error) {
    // Fallback to generic metadata
    return await fetchGenericMetadata(url);
  }
}

// Fetch Instagram metadata
async function fetchInstagramMetadata(url) {
  try {
    // Instagram doesn't provide much metadata without authentication
    // Try to get what we can from OG tags
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookmarkBot/1.0)",
      },
    });

    const $ = cheerio.load(response.data);

    const metadata = {
      title: $('meta[property="og:title"]').attr("content") || "Instagram Post",
      description:
        $('meta[property="og:description"]').attr("content") ||
        "Instagram photo or video",
      image: $('meta[property="og:image"]').attr("content") || null,
      siteName: "Instagram",
    };

    return metadata;
  } catch (error) {
    // Fallback to generic metadata
    return await fetchGenericMetadata(url);
  }
}

// Fetch YouTube metadata using oEmbed
async function fetchYoutubeMetadata(url) {
  try {
    // Get oEmbed data
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const oembedResponse = await axios.get(oembedUrl);
    const oembedData = oembedResponse.data;

    // Also get OG metadata for more info
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookmarkBot/1.0)",
      },
    });

    const $ = cheerio.load(response.data);

    const metadata = {
      title:
        oembedData.title ||
        $('meta[property="og:title"]').attr("content") ||
        "YouTube Video",
      description:
        $('meta[property="og:description"]').attr("content") ||
        "No description available",
      image:
        oembedData.thumbnail_url ||
        $('meta[property="og:image"]').attr("content") ||
        null,
      siteName: "YouTube",
    };

    return metadata;
  } catch (error) {
    // Fallback to generic metadata
    return await fetchGenericMetadata(url);
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
