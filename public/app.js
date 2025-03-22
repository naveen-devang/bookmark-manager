document.addEventListener("DOMContentLoaded", async () => {
  // Fetch Supabase credentials from server
  let supabaseClient;

  try {
    const configResponse = await fetch("/api/config");
    if (!configResponse.ok) {
      throw new Error("Failed to load application configuration");
    }

    const config = await configResponse.json();

    // Initialize Supabase client
    supabaseClient = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseKey,
    );
  } catch (error) {
    console.error("Error initializing application:", error);
    document.body.innerHTML = `
      <div class="flex justify-center items-center h-screen">
        <div class="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-xl max-w-md border border-red-200 dark:border-red-800">
          <h2 class="text-xl font-bold text-red-700 dark:text-red-400 mb-4">Application Error</h2>
          <p class="text-slate-700 dark:text-slate-300">Failed to initialize the application. Please try refreshing the page.</p>
        </div>
      </div>
    `;
    return;
  }

  // DOM elements
  const bookmarkForm = document.getElementById("bookmarkForm");
  const urlInput = document.getElementById("urlInput");
  const fetchUrlButton = document.getElementById("fetchUrlButton");
  const previewContainer = document.getElementById("previewContainer");
  const previewImageContainer = document.getElementById(
    "previewImageContainer",
  );
  const previewImage = document.getElementById("previewImage");
  const previewTitle = document.getElementById("previewTitle");
  const previewDescription = document.getElementById("previewDescription");
  const previewTags = document.getElementById("previewTags");
  const saveBookmarkButton = document.getElementById("saveBookmarkButton");
  const bookmarksContainer = document.getElementById("bookmarksContainer");
  const loading = document.getElementById("loading");

  // Dialog elements
  const dialogOverlay = document.getElementById("dialogOverlay");
  const dialogContent = document.getElementById("dialogContent");
  const dialogClose = document.getElementById("dialogClose");
  const editForm = document.getElementById("editForm");
  const editId = document.getElementById("editId");
  const editTitle = document.getElementById("editTitle");
  const editDescription = document.getElementById("editDescription");
  const editTags = document.getElementById("editTags");

  const addDialogOverlay = document.getElementById("addDialogOverlay");
  const addDialogContent = document.getElementById("addDialogContent");
  const addDialogClose = document.getElementById("addDialogClose");
  const addBookmarkForm = document.getElementById("addBookmarkForm");
  const addTitle = document.getElementById("addTitle");
  const addDescription = document.getElementById("addDescription");
  const addTags = document.getElementById("addTags");
  

  // Toast viewport
  const toastViewport = document.getElementById("toastViewport");

  // Pagination variables
  let currentPage = 1;
  const pageSize = 12; // Number of bookmarks per page
  let isLoading = false;
  let hasMoreBookmarks = true;

  const fetchButton = document.getElementById("fetchUrlButton");
  // Wrap the text content in a span for proper z-indexing
  const buttonText = fetchButton.textContent;
  fetchButton.innerHTML = `<span>${buttonText}</span>`;

  // Initialize Three.js
  const scene = new THREE.Scene();

  // Use an orthographic camera for full coverage
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });

  // Configure renderer
  const container = document.getElementById("background-canvas");
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0); // Transparent background
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Apply styles directly to the canvas
  const canvas = renderer.domElement;
  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.zIndex = "-1";

  // Create shader material with more dynamic animation
  const vertexShader = `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float time;
    uniform vec3 colorA;
    uniform vec3 colorB;
    uniform vec3 colorC;
    uniform vec3 colorD;
    uniform vec2 resolution;
    varying vec2 vUv;

    // 2D Noise function
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                 -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
        dot(x12.zw,x12.zw)), 0.0);
      m = m*m;
      m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    // Function to create flowing shapes
    float flowingField(vec2 uv, float time) {
      // Create multiple layers of noise with different speeds and scales
      float noise1 = snoise(uv * 1.5 + vec2(time * 0.1, time * 0.08));
      float noise2 = snoise(uv * 2.3 + vec2(-time * 0.15, time * 0.12));
      float noise3 = snoise(uv * 3.7 + vec2(time * 0.2, -time * 0.14));

      // Combine noise layers for more interesting patterns
      return (noise1 + noise2 * 0.8 + noise3 * 0.6) / 2.4;
    }

    // Function to create moving blob shapes
    float blob(vec2 uv, vec2 center, float radius, float fuzziness) {
      float dist = length(uv - center);
      return smoothstep(radius, radius + fuzziness, dist);
    }

    void main() {
      // Create aspect-correct UV coordinates
      vec2 uv = vUv;

      // Time variables for different animation speeds
      float slowTime = time * 0.15;
      float mediumTime = time * 0.3;
      float fastTime = time * 0.5;

      // Create multiple flowing fields with different parameters
      float flow1 = flowingField(uv, slowTime);
      float flow2 = flowingField(uv * 1.3 + 150.0, mediumTime);

      // Create moving blobs
      vec2 blob1Center = vec2(
        0.5 + 0.25 * sin(slowTime),
        0.5 + 0.25 * cos(slowTime * 0.7)
      );

      vec2 blob2Center = vec2(
        0.5 + 0.3 * cos(slowTime * 0.8),
        0.5 + 0.3 * sin(slowTime * 1.2)
      );

      vec2 blob3Center = vec2(
        0.5 + 0.2 * sin(slowTime * 1.3),
        0.5 + 0.2 * cos(slowTime)
      );

      // Create soft-edged blobs that interact with the flow fields
      float blob1 = blob(uv, blob1Center, 0.1 + 0.05 * sin(fastTime), 0.6);
      float blob2 = blob(uv, blob2Center, 0.15 + 0.07 * cos(fastTime * 1.2), 0.5);
      float blob3 = blob(uv, blob3Center, 0.12 + 0.06 * sin(fastTime * 0.7), 0.4);

      // Combine blobs with flow fields to create movement interactions
      float combinedField = flow1 * flow2;
      float blobField = blob1 * blob2 * blob3;

      // Create motion distortion by offsetting UVs with flow field
      vec2 distortedUV = uv + vec2(
        0.02 * sin(flow1 * 6.28 + mediumTime),
        0.02 * cos(flow2 * 6.28 + mediumTime)
      );

      // Add waves that move across the screen
      float wave1 = 0.5 + 0.5 * sin(distortedUV.x * 5.0 + slowTime);
      float wave2 = 0.5 + 0.5 * cos(distortedUV.y * 4.0 - slowTime * 1.2);

      // Create dynamic color mixing with moving gradients
      vec3 color1 = mix(colorA, colorB, wave1 * blobField);
      vec3 color2 = mix(colorC, colorD, wave2 * (1.0 - blobField));

      // Final color with dynamic blending
      vec3 finalColor = mix(color1, color2, flow1 * 0.5 + 0.5);

      // Add highlights that move with the flow
      float highlight = smoothstep(0.4, 0.6, flow2 * wave1 * wave2);
      finalColor = mix(finalColor, vec3(1.0), highlight * 0.15);

      // Apply subtle vignette
      float vignette = smoothstep(0.0, 0.7, length(uv - 0.5));
      finalColor = mix(finalColor, finalColor * 0.8, vignette * 0.5);

      gl_FragColor = vec4(finalColor, 0.95);
    }
  `;

  // Create shader material with uniforms for colors and resolution
  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      colorA: { value: new THREE.Color(0x6366f1) }, // indigo
      colorB: { value: new THREE.Color(0xa855f7) }, // purple
      colorC: { value: new THREE.Color(0x3b82f6) }, // blue
      colorD: { value: new THREE.Color(0xec4899) }, // pink
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    transparent: true,
  });

  // Create a plane that fills the camera view
  const geometry = new THREE.PlaneGeometry(2, 2);
  const plane = new THREE.Mesh(geometry, shaderMaterial);
  scene.add(plane);

  // Position camera
  camera.position.z = 1;

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    // Update time uniform for animation
    shaderMaterial.uniforms.time.value += 0.01; // Increased speed for more visible movement

    // Check if dark mode is active to adjust colors
    const isDarkMode = document.documentElement.classList.contains("dark");
    if (isDarkMode) {
      // Deeper, richer colors for dark mode
      shaderMaterial.uniforms.colorA.value.set(0x312e81); // deep indigo
      shaderMaterial.uniforms.colorB.value.set(0x4c1d95); // deep purple
      shaderMaterial.uniforms.colorC.value.set(0x1e3a8a); // deep blue
      shaderMaterial.uniforms.colorD.value.set(0x831843); // deep pink
    } else {
      // Lighter colors for light mode
      shaderMaterial.uniforms.colorA.value.set(0x818cf8); // light indigo
      shaderMaterial.uniforms.colorB.value.set(0xc084fc); // light purple
      shaderMaterial.uniforms.colorC.value.set(0x93c5fd); // light blue
      shaderMaterial.uniforms.colorD.value.set(0xfbcfe8); // light pink
    }

    renderer.render(scene, camera);
  }

  // Proper resize handler
  function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update renderer size
    renderer.setSize(width, height);

    // Update resolution uniform
    shaderMaterial.uniforms.resolution.value.set(width, height);

    // Update camera
    camera.updateProjectionMatrix();
  }

  // Handle window resize
  window.addEventListener("resize", handleResize);

  // Reduce quality on mobile for better performance
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    renderer.setPixelRatio(1);
  }

  // Start animation
  animate();

  // Update colors when theme changes
  document.getElementById("themeToggle").addEventListener("click", function () {
    // Colors will update in the next animation frame
  });

  // Create a loading indicator for infinite scroll
  const scrollLoadingIndicator = document.createElement("div");
  scrollLoadingIndicator.className =
    "col-span-full flex justify-center py-8 hidden";
  scrollLoadingIndicator.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="animate-spin h-5 w-5 border-2 border-indigo-500 dark:border-indigo-400 rounded-full border-t-transparent"></div>
      <span class="text-slate-500 dark:text-slate-400">Loading more bookmarks...</span>
    </div>
  `;
  bookmarksContainer.after(scrollLoadingIndicator);

  // Create back to top button
  const backToTopButton = document.createElement("button");
  backToTopButton.className =
    "fixed bottom-24 right-8 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full p-3 transition-all duration-300 opacity-0 translate-y-10 z-20 border border-indigo-200 dark:border-indigo-900";
  backToTopButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
  `;
  document.body.appendChild(backToTopButton);

  // Theme toggle functionality
  const themeToggle = document.getElementById("themeToggle");

  // Check for saved theme preference or use device preference
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Metadata storage
  let currentMetadata = null;

  let masonryGrid;

  function initMasonry() {
    const grid = document.querySelector(".masonry-grid");
    if (!grid) return;

    // Initialize Masonry with options
    masonryGrid = new Masonry(grid, {
      itemSelector: ".masonry-item",
      columnWidth: ".masonry-item",
      percentPosition: true,
      gutter: 16, // This should match your CSS gap value (1rem = 16px)
      transitionDuration: "0.2s",
    });

    // Use imagesLoaded to prevent layout issues with images
    imagesLoaded(grid).on("progress", function () {
      masonryGrid.layout();
    });
  }

  document.addEventListener(
    "load",
    (event) => {
      if (event.target.tagName === "IMG" && masonryGrid) {
        masonryGrid.layout();
      }
    },
    true,
  );

  // Pastel colors for cards
  const pastelColors = [
    {
      light: "bg-pastel-blue-light",
      dark: "dark:bg-pastel-blue-light",
      border: "border-blue-200 dark:border-blue-400",
      textColor: "text-slate-800 dark:text-slate-900", // Added text color
    },
    {
      light: "bg-pastel-green-light",
      dark: "dark:bg-pastel-green-light",
      border: "border-green-200 dark:border-green-400",
      textColor: "text-slate-800 dark:text-slate-900",
    },
    {
      light: "bg-pastel-pink-light",
      dark: "dark:bg-pastel-pink-light",
      border: "border-pink-200 dark:border-pink-400",
      textColor: "text-slate-800 dark:text-slate-900",
    },
    {
      light: "bg-pastel-purple-light",
      dark: "dark:bg-pastel-purple-light",
      border: "border-purple-200 dark:border-purple-400",
      textColor: "text-slate-800 dark:text-slate-900",
    },
    {
      light: "bg-pastel-yellow-light",
      dark: "dark:bg-pastel-yellow-light",
      border: "border-yellow-200 dark:border-yellow-400",
      textColor: "text-slate-800 dark:text-slate-900",
    },
    {
      light: "bg-pastel-orange-light",
      dark: "dark:bg-pastel-orange-light",
      border: "border-orange-200 dark:border-orange-400",
      textColor: "text-slate-800 dark:text-slate-900",
    },
  ];

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add("dark");
  }

  // Handle theme toggle button click
  themeToggle.addEventListener("click", function () {
    // Check current theme
    const isDark = document.documentElement.classList.contains("dark");

    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  });

  // Fetch URL metadata when button is clicked
  fetchUrlButton.addEventListener("click", async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    try {
        showToast("Fetching URL details...", "info");

        const response = await fetch("/api/fetch-metadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });

        if (!response.ok) {
            throw new Error("Failed to fetch URL details");
        }

        const metadata = await response.json();

        // Populate form fields
        addTitle.value = metadata.title || "";
        addDescription.value = metadata.description || "";
        addTags.value = "";

        // Handle preview image
        const previewImage = document.getElementById("addPreviewImage");
        const previewImageContainer = document.getElementById("addPreviewImageContainer");

        if (metadata.image) {
            previewImage.src = metadata.image;
            previewImage.style.display = "block";

            // Wait for the image to load before adjusting size
            previewImage.onload = function () {
                const naturalWidth = previewImage.naturalWidth;
                const naturalHeight = previewImage.naturalHeight;

                // Apply actual dimensions
                previewImage.style.width = `${naturalWidth}px`;
                previewImage.style.height = `${naturalHeight}px`;

                // Show the container
                previewImageContainer.classList.remove("hidden");
            };
        } else {
            previewImageContainer.classList.add("hidden");
        }

        // Show overlay
        addDialogOverlay.classList.remove("hidden");
        addDialogContent.classList.remove("hidden");

        // Trigger reflow for smooth animation
        void addDialogOverlay.offsetWidth;
        void addDialogContent.offsetWidth;

        addDialogOverlay.classList.add("opacity-100");
        addDialogContent.classList.add("opacity-100", "scale-100");

        showToast("URL details fetched! You can edit before saving.", "success");
    } catch (error) {
        console.error("Error fetching URL details:", error);
        showToast("Failed to fetch URL details", "error");
    }
});



addBookmarkForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const url = urlInput.value.trim();
  const title = addTitle.value.trim();
  const description = addDescription.value.trim();
  const tagsString = addTags.value.trim();
  const tags = tagsString ? tagsString.split(",").map(tag => tag.trim()) : [];

  // Get image URL
  let image_url = document.getElementById("addPreviewImage").src;
  if (!image_url || image_url.includes("default.png")) {
      image_url = null;
  }

  try {
      showToast("Adding bookmark...", "info");

      const response = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, title, description, image_url, tags }),
      });

      if (!response.ok) {
          throw new Error("Failed to add bookmark");
      }

      const newBookmark = await response.json();

      // Close the modal
      closeAddDialog();

      // Clear input fields
      urlInput.value = "";
      addTitle.value = "";
      addDescription.value = "";
      addTags.value = "";
      document.getElementById("addPreviewImage").src = ""; // Reset image

      // ✅ Add the new bookmark to the UI instantly
      addBookmarkToUI(newBookmark, 0, true);

      showToast("Bookmark added successfully!", "success");
  } catch (error) {
      console.error("Error adding bookmark:", error);
      showToast("Failed to add bookmark", "error");
  }
});




function closeAddDialog() {
  addDialogOverlay.classList.remove("opacity-100");
  addDialogContent.classList.remove("opacity-100", "scale-100");

  setTimeout(() => {
      addDialogOverlay.classList.add("hidden");
      addDialogContent.classList.add("hidden");
  }, 300);
}

addDialogClose.addEventListener("click", closeAddDialog);
addDialogOverlay.addEventListener("click", closeAddDialog);



  // Save bookmark when form is submitted

  // Allow enter key to trigger fetch URL button
  urlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fetchUrlButton.click();
    }
  });


  // Fetch all bookmarks
  async function fetchBookmarks(reset = true) {
    try {
      if (reset) {
        currentPage = 1;
        hasMoreBookmarks = true;

        // Clear the container but keep the grid-sizer and gutter-sizer
        const gridSizer = document.querySelector(".grid-sizer");
        const gutterSizer = document.querySelector(".gutter-sizer");
        const loadingElem = document.getElementById("loading");

        bookmarksContainer.innerHTML = "";

        // Re-add the required elements
        if (gridSizer && gutterSizer) {
          bookmarksContainer.appendChild(gridSizer.cloneNode(true));
          bookmarksContainer.appendChild(gutterSizer.cloneNode(true));
        } else {
          // First time - add the required elements
          const newGridSizer = document.createElement("div");
          newGridSizer.className = "grid-sizer";

          const newGutterSizer = document.createElement("div");
          newGutterSizer.className = "gutter-sizer";

          bookmarksContainer.appendChild(newGridSizer);
          bookmarksContainer.appendChild(newGutterSizer);
        }

        // Add loading indicator back
        if (loadingElem) {
          bookmarksContainer.appendChild(loadingElem);
          loadingElem.style.display = "flex";
        }

        // Destroy existing masonry instance if exists
        if (masonryGrid) {
          masonryGrid.destroy();
          masonryGrid = null;
        }
      } else {
        scrollLoadingIndicator.classList.remove("hidden");
      }

      isLoading = true;

      // Fetch bookmarks from API
      const response = await fetch(
        `/api/bookmarks?page=${currentPage}&limit=${pageSize}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch bookmarks");
      }

      const data = await response.json();
      const bookmarks = data.bookmarks || data;

      // Check if there are more bookmarks
      hasMoreBookmarks =
        Array.isArray(bookmarks) && bookmarks.length === pageSize;

      // Hide loading indicators
      const loadingElement = document.getElementById("loading");
      if (loadingElement) {
        loadingElement.style.display = "none";
      }
      scrollLoadingIndicator.classList.add("hidden");

      // Show no bookmarks message if needed
      if (
        Array.isArray(bookmarks) &&
        bookmarks.length === 0 &&
        currentPage === 1
      ) {
        // Create a placeholder element that spans full width
        const noBookmarksMessage = document.createElement("div");
        noBookmarksMessage.className = "masonry-item w-full";
        noBookmarksMessage.style.width = "100%";
        noBookmarksMessage.innerHTML = `
                  <div class="text-center py-12 bg-pastel-blue-light dark:bg-pastel-blue-dark rounded-xl text-slate-700 dark:text-slate-300 text-lg relative overflow-hidden border border-blue-200 dark:border-blue-900">
                      No bookmarks yet. Add your first bookmark above!
                  </div>
              `;
        bookmarksContainer.appendChild(noBookmarksMessage);
        return;
      }

      // Render bookmarks
      if (Array.isArray(bookmarks)) {
        bookmarks.forEach((bookmark, index) => {
          addBookmarkToUI(bookmark, (currentPage - 1) * pageSize + index);
        });
      }

      // Initialize or update Masonry layout
      if (reset) {
        // Initialize Masonry after the first batch of items is loaded
        setTimeout(initMasonry, 100);
      } else if (masonryGrid) {
        // For subsequent pages, just update the layout
        setTimeout(() => {
          masonryGrid.layout();
        }, 100);
      }

      isLoading = false;
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      const loadingElement = document.getElementById("loading");
      if (loadingElement) {
        loadingElement.textContent =
          "Failed to load bookmarks. Please try again.";
      }
      scrollLoadingIndicator.classList.add("hidden");
      isLoading = false;
    }
  }

  // Function to load more bookmarks
  function loadMoreBookmarks() {
    if (isLoading || !hasMoreBookmarks) return;

    currentPage++;
    fetchBookmarks(false);
  }

  // Add a bookmark to the UI
  function addBookmarkToUI(bookmark, index = 0, isNewBookmark = false) {
    const bookmarkCard = document.createElement("div");
    bookmarkCard.className = "masonry-item is-visible";
    bookmarkCard.dataset.id = bookmark.id;

    const imageUrl = bookmark.image_url || "default.png";
    const title = bookmark.title || "Untitled";
    const description = bookmark.description || "No description available";
    const domain = new URL(bookmark.url).hostname.replace("www.", "");
    const date = new Date(bookmark.created_at).toLocaleDateString();

    // Create tags HTML if available
    let tagsHtml = "";
    if (bookmark.tags && bookmark.tags.length > 0) {
        tagsHtml = `<div class="flex flex-wrap gap-2 mt-4">
            ${bookmark.tags.map(tag => `<span class="py-1 px-3 rounded-full text-xs tag-pill bg-indigo-200 text-indigo-800">${tag}</span>`).join("")}
        </div>`;
    }

    bookmarkCard.innerHTML = `
        <div class="bookmark-card rounded-xl overflow-hidden relative bg-white shadow-md border border-gray-200 transition-all hover:shadow-lg">
            <div class="bookmark-image-container">
                <img class="bookmark-image w-full h-auto object-cover bg-gray-100" src="${imageUrl}" alt="${title}" onerror="this.src='default.png'">
            </div>
            <div class="p-6">
                <h3 class="text-xl font-bold mb-3 break-words">
                    <a href="${bookmark.url}" class="text-gray-800 hover:text-indigo-500 transition" target="_blank">${title}</a>
                </h3>
                <div class="description-container">
                    <p class="text-gray-600 mb-2 line-clamp-3 description-text">${description}</p>
                    <button class="read-more-btn text-indigo-500 text-sm font-medium hover:underline hidden">Read more</button>
                </div>
                ${tagsHtml}
                <div class="flex justify-between items-center text-sm text-gray-500 mt-4 pt-4 border-t border-gray-200">
                    <span>${domain}</span>
                    <span>${date}</span>
                </div>
                <div class="flex gap-4 mt-6">
                    <button class="text-gray-600 hover:text-indigo-500 edit-button" data-id="${bookmark.id}">Edit</button>
                    <button class="text-gray-600 hover:text-red-500 delete-button" data-id="${bookmark.id}">Delete</button>
                </div>
            </div>
        </div>
    `;

    // Add event listeners for edit and delete buttons
    const editButton = bookmarkCard.querySelector(".edit-button");
    const deleteButton = bookmarkCard.querySelector(".delete-button");

    editButton.addEventListener("click", () => openEditDialog(bookmark));
    deleteButton.addEventListener("click", () => deleteBookmark(bookmark.id));

    // Handle "Read More" functionality
    const descriptionText = bookmarkCard.querySelector(".description-text");
    const readMoreBtn = bookmarkCard.querySelector(".read-more-btn");

    if (description.length > 150) {
        readMoreBtn.classList.remove("hidden");

        readMoreBtn.addEventListener("click", function () {
            if (descriptionText.classList.contains("line-clamp-3")) {
                descriptionText.classList.remove("line-clamp-3");
                this.textContent = "Read less";
            } else {
                descriptionText.classList.add("line-clamp-3");
                this.textContent = "Read more";
            }

            // Ensure Masonry layout updates after expanding/collapsing
            if (typeof masonryGrid !== "undefined" && masonryGrid) {
                setTimeout(() => masonryGrid.layout(), 50);
            }
        });
    }

    // ✅ Insert at the top (so the newest bookmark appears first)
    bookmarksContainer.append(bookmarkCard);

    // ✅ Update Masonry grid (if used)
    if (typeof masonryGrid !== "undefined" && masonryGrid) {
        masonryGrid.prepended([bookmarkCard]);
        setTimeout(() => masonryGrid.layout(), 100);
    }

    // Ensure image loads correctly for Masonry layout
    const cardImage = bookmarkCard.querySelector(".bookmark-image");
    if (cardImage) {
        cardImage.onload = function () {
            if (typeof masonryGrid !== "undefined" && masonryGrid) {
                masonryGrid.layout();
            }
        };
    }
}


  // Delete a bookmark
  async function deleteBookmark(id) {
    if (!confirm("Are you sure you want to delete this bookmark?")) return;

    try {
      const response = await fetch(`/api/bookmarks/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete bookmark");
      }

      // Remove the bookmark from the UI
      const bookmarkCard = document.querySelector(`[data-id="${id}"]`);
      if (bookmarkCard) {
        // If Masonry is initialized, use its method to remove the element
        if (masonryGrid) {
          masonryGrid.remove(bookmarkCard);
          // Allow time for the removal animation before updating layout
          setTimeout(() => {
            masonryGrid.layout();
          }, 300);
        } else {
          // Fallback for when Masonry is not available
          bookmarkCard.remove();
        }
      }

      showToast("Bookmark deleted successfully!", "success");

      // Check if we need to show the no bookmarks message
      if (bookmarksContainer.children.length === 0) {
        bookmarksContainer.innerHTML = `
          <div class="col-span-full text-center py-12 bg-pastel-blue-light dark:bg-pastel-blue-dark rounded-xl text-slate-700 dark:text-slate-300 text-lg relative overflow-hidden border border-blue-200 dark:border-blue-900">
            No bookmarks yet. Add your first bookmark above!
          </div>
        `;
      }
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      showToast("Failed to delete bookmark", "error");
    }
  }

  // Open edit dialog
  function openEditDialog(bookmark) {
    editId.value = bookmark.id;
    editTitle.value = bookmark.title || "";
    editDescription.value = bookmark.description || "";
    editTags.value = bookmark.tags ? bookmark.tags.join(", ") : "";

    // Show dialog with animation
    dialogOverlay.classList.remove("hidden");
    dialogContent.classList.remove("hidden");

    // Trigger reflow to ensure transitions work
    void dialogOverlay.offsetWidth;
    void dialogContent.offsetWidth;

    dialogOverlay.classList.add("opacity-100");
    dialogContent.classList.add("opacity-100", "scale-100");
  }

  // Close dialog
  function closeDialog() {
    dialogOverlay.classList.remove("opacity-100");
    dialogContent.classList.remove("opacity-100", "scale-100");

    // Wait for transition to finish before hiding
    setTimeout(() => {
      dialogOverlay.classList.add("hidden");
      dialogContent.classList.add("hidden");
    }, 300);
  }

  // Dialog close button event
  dialogClose.addEventListener("click", closeDialog);
  dialogOverlay.addEventListener("click", closeDialog);

  // Edit form submission
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = editId.value;
    const title = editTitle.value.trim();
    const description = editDescription.value.trim();
    const tagsString = editTags.value.trim();
    const tags = tagsString
      ? tagsString.split(",").map((tag) => tag.trim())
      : [];

    try {
      const response = await fetch(`/api/bookmarks/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          tags,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update bookmark");
      }

      const updatedBookmark = await response.json();

      // Update the bookmark in the UI
      const bookmarkCard = document.querySelector(`[data-id="${id}"]`);
      if (bookmarkCard) {
        bookmarkCard.remove();
        addBookmarkToUI(updatedBookmark, 0, true);
      }

      closeDialog();
      showToast("Bookmark updated successfully!", "success");
    } catch (error) {
      console.error("Error updating bookmark:", error);
      showToast("Failed to update bookmark", "error");
    }
  });

  // Show toast notification
  function showToast(message, type = "info") {
    // Create toast element
    const toast = document.createElement("div");
    toast.className = `flex items-center gap-4 p-5 rounded-xl mb-4 transform translate-x-full transition-all duration-500 ease-out max-w-md relative overflow-hidden ${getToastClass(type)}`;

    // Add left border color based on type
    toast.innerHTML = `
      <div class="flex-1 font-medium">${message}</div>
      <button class="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    // Add toast to viewport
    toastViewport.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.remove("translate-x-full");
      toast.classList.add("translate-x-0");
    }, 10);

    // Set up close button
    const closeButton = toast.querySelector("button");
    closeButton.addEventListener("click", () => {
      removeToast(toast);
    });

    // Auto remove after 3 seconds
    setTimeout(() => {
      removeToast(toast);
    }, 3000);
  }

  // Helper to remove toast with animation
  function removeToast(toast) {
    toast.classList.add("translate-x-full");
    toast.classList.add("opacity-0");

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  // Get toast class based on type
  function getToastClass(type) {
    switch (type) {
      case "success":
        return "bg-pastel-green-light dark:bg-pastel-green-dark border border-green-200 dark:border-green-900";
      case "error":
        return "bg-pastel-pink-light dark:bg-pastel-pink-dark border border-pink-200 dark:border-pink-900";
      case "info":
      default:
        return "bg-pastel-blue-light dark:bg-pastel-blue-dark border border-blue-200 dark:border-blue-900";
    }
  }

  // Add scroll event listener for infinite scrolling
  window.addEventListener("scroll", handleScroll);

  // Function to handle scroll event
  function handleScroll() {
    if (isLoading || !hasMoreBookmarks) return;

    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // When user has scrolled to the bottom (with a buffer of 200px)
    if (scrollY + windowHeight >= documentHeight - 200) {
      loadMoreBookmarks();
    }

    // Show/hide back to top button based on scroll position
    if (scrollY > 500) {
      backToTopButton.classList.remove("opacity-0", "translate-y-10");
      backToTopButton.classList.add("opacity-100", "translate-y-0");
    } else {
      backToTopButton.classList.add("opacity-0", "translate-y-10");
      backToTopButton.classList.remove("opacity-100", "translate-y-0");
    }
  }

  // Scroll to top when button is clicked
  backToTopButton.addEventListener("click", function () {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });

  // Load bookmarks on page load
  fetchBookmarks();
});
