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
        <div class="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-xl max-w-md">
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

  // Toast viewport
  const toastViewport = document.getElementById("toastViewport");

  // Pagination variables
  let currentPage = 1;
  const pageSize = 12; // Number of bookmarks per page
  let isLoading = false;
  let hasMoreBookmarks = true;

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
    "fixed bottom-8 right-8 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full p-3 shadow-lg transition-all duration-300 opacity-0 translate-y-10 z-20";
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

      // Call the API to fetch URL metadata
      const response = await fetch("/api/fetch-metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch URL details");
      }

      const metadata = await response.json();
      currentMetadata = metadata;

      // Show preview
      previewTitle.value = metadata.title || "";
      previewDescription.value = metadata.description || "";
      previewTags.value = "";

      if (metadata.image) {
        previewImage.src = metadata.image;
        previewImage.style.display = "block";
      } else {
        previewImage.src = "placeholder.jpg";
        previewImage.style.display = "block";
      }

      // Show preview container
      previewContainer.classList.remove("hidden");
      showToast("URL details fetched! You can edit before saving.", "success");
    } catch (error) {
      console.error("Error fetching URL details:", error);
      showToast(error.message || "Failed to fetch URL details", "error");
    }
  });

  // Save bookmark when form is submitted
  saveBookmarkButton.addEventListener("click", async () => {
    const url = urlInput.value.trim();

    if (!url || !currentMetadata) return;

    try {
      showToast("Adding bookmark...", "info");

      // Get edited values
      const title = previewTitle.value.trim();
      const description = previewDescription.value.trim();
      const tagsString = previewTags.value.trim();
      const tags = tagsString
        ? tagsString.split(",").map((tag) => tag.trim())
        : [];
      const image_url =
        previewImage.src !== "placeholder.jpg" ? previewImage.src : null;

      // Call the API to save bookmark with edited metadata
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          title,
          description,
          image_url,
          tags,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add bookmark");
      }

      const data = await response.json();

      // Clear form and preview
      urlInput.value = "";
      previewContainer.classList.add("hidden");
      // Reset the preview image to avoid caching issues
      previewImage.src = "placeholder.jpg";
      previewTitle.value = "";
      previewDescription.value = "";
      previewTags.value = "";
      currentMetadata = null;

      // Add the new bookmark to the UI
      addBookmarkToUI(data, 0, true);
      showToast("Bookmark added successfully!", "success");
    } catch (error) {
      console.error("Error adding bookmark:", error);
      showToast(error.message || "Failed to add bookmark", "error");
    }
  });

  // Allow enter key to trigger fetch URL button
  urlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fetchUrlButton.click();
    }
  });

  // Cancel bookmark addition
  document
    .getElementById("cancelBookmarkButton")
    .addEventListener("click", () => {
      urlInput.value = "";
      previewContainer.classList.add("hidden");
      // Reset the preview image and all fields
      previewImage.src = "placeholder.jpg";
      previewTitle.value = "";
      previewDescription.value = "";
      previewTags.value = "";
      currentMetadata = null;
    });

  // Fetch all bookmarks
  async function fetchBookmarks(reset = true) {
    try {
      if (reset) {
        currentPage = 1;
        hasMoreBookmarks = true;
        bookmarksContainer.innerHTML = ""; // Clear the container
        loading.style.display = "flex"; // Show initial loading indicator
      } else {
        scrollLoadingIndicator.classList.remove("hidden");
      }

      isLoading = true;

      // Modify your fetch call to include pagination parameters
      const response = await fetch(
        `/api/bookmarks?page=${currentPage}&limit=${pageSize}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch bookmarks");
      }

      const data = await response.json();
      const bookmarks = data.bookmarks || data; // Handle both formats

      // Check if there are more bookmarks
      hasMoreBookmarks =
        Array.isArray(bookmarks) && bookmarks.length === pageSize;

      // Remove loading indicators
      loading.style.display = "none";
      scrollLoadingIndicator.classList.add("hidden");

      // Show no bookmarks message if needed
      if (
        Array.isArray(bookmarks) &&
        bookmarks.length === 0 &&
        currentPage === 1
      ) {
        bookmarksContainer.innerHTML = `
          <div class="col-span-full text-center py-12 bg-card-light dark:bg-card-dark rounded-xl shadow-card dark:shadow-card-dark text-slate-500 dark:text-slate-400 text-lg relative overflow-hidden">
            No bookmarks yet. Add your first bookmark above!
          </div>
        `;
        return;
      }

      // Render bookmarks
      if (Array.isArray(bookmarks)) {
        bookmarks.forEach((bookmark, index) => {
          addBookmarkToUI(bookmark, (currentPage - 1) * pageSize + index);
        });
      }

      isLoading = false;
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      loading.textContent = "Failed to load bookmarks. Please try again.";
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
    bookmarkCard.className = "masonry-item";
    bookmarkCard.dataset.id = bookmark.id;
    bookmarkCard.style.setProperty("--animation-order", index % 10); // Limit animation delay

    const imageUrl = bookmark.image_url || "placeholder.jpg";
    const title = bookmark.title || "Untitled";
    const description = bookmark.description || "No description";
    const domain = new URL(bookmark.url).hostname.replace("www.", "");
    const date = new Date(bookmark.created_at).toLocaleDateString();

    // Create tags HTML if available
    let tagsHtml = "";
    if (bookmark.tags && bookmark.tags.length > 0) {
      tagsHtml = `
              <div class="flex flex-wrap gap-2 mt-4">
                  ${bookmark.tags.map((tag) => `<span class="py-1 px-3 rounded-full text-xs bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 hover:text-white hover:border-transparent transition-all">${tag}</span>`).join("")}
              </div>
          `;
    }

    bookmarkCard.innerHTML = `
          <div class="bookmark-card bg-card-light dark:bg-card-dark rounded-xl overflow-hidden shadow-card dark:shadow-card-dark">
              <div class="bookmark-image-container">
                  <img class="bookmark-image w-full h-auto object-cover bg-slate-100 dark:bg-slate-800" src="${imageUrl}" alt="${title}" onerror="this.src='placeholder.jpg'">
              </div>
              <div class="p-6">
                  <h3 class="text-xl font-bold mb-3 break-words">
                      <a href="${bookmark.url}" class="text-slate-800 dark:text-slate-100 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors" target="_blank" rel="noopener noreferrer">${title}</a>
                  </h3>
                  <div class="description-container">
                      <p class="text-slate-500 dark:text-slate-400 mb-2 line-clamp-3 description-text">${description}</p>
                      <button class="read-more-btn text-indigo-500 dark:text-indigo-400 text-sm font-medium hover:underline hidden">Read more</button>
                  </div>
                  ${tagsHtml}
                  <div class="flex justify-between items-center text-sm text-slate-400 dark:text-slate-500 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <span>${domain}</span>
                      <span>${date}</span>
                  </div>
                  <div class="flex gap-4 mt-6">
                      <button class="text-slate-500 dark:text-slate-400 font-semibold text-sm hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors edit-button" data-id="${bookmark.id}">Edit</button>
                      <button class="text-slate-500 dark:text-slate-400 font-semibold text-sm hover:text-red-500 dark:hover:text-red-400 transition-colors delete-button" data-id="${bookmark.id}">Delete</button>
                  </div>
              </div>
          </div>
      `;

    // Add event listeners for edit and delete buttons
    const editButton = bookmarkCard.querySelector(".edit-button");
    const deleteButton = bookmarkCard.querySelector(".delete-button");

    editButton.addEventListener("click", () => openEditDialog(bookmark));
    deleteButton.addEventListener("click", () => deleteBookmark(bookmark.id));

    // Add event listener for read more button
    const descriptionText = bookmarkCard.querySelector(".description-text");
    const readMoreBtn = bookmarkCard.querySelector(".read-more-btn");

    // Check if description needs a "Read more" button (if it's likely to exceed 3 lines)
    if (description.length > 150) {
      readMoreBtn.classList.remove("hidden");

      // Toggle between expanded and collapsed state
      readMoreBtn.addEventListener("click", function () {
        if (descriptionText.classList.contains("line-clamp-3")) {
          // Expand
          descriptionText.classList.remove("line-clamp-3");
          this.textContent = "Read less";
        } else {
          // Collapse
          descriptionText.classList.add("line-clamp-3");
          this.textContent = "Read more";
        }
      });
    }

    // If it's a new bookmark (not from pagination), insert at the beginning
    if (isNewBookmark && bookmarksContainer.children.length > 0) {
      bookmarksContainer.insertBefore(
        bookmarkCard,
        bookmarksContainer.firstChild,
      );
    } else {
      bookmarksContainer.appendChild(bookmarkCard);
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
        bookmarkCard.remove();
      }

      showToast("Bookmark deleted successfully!", "success");

      // Check if we need to show the no bookmarks message
      if (bookmarksContainer.children.length === 0) {
        bookmarksContainer.innerHTML =
          '<div class="col-span-full text-center py-12 bg-card-light dark:bg-card-dark rounded-xl shadow-card dark:shadow-card-dark text-slate-500 dark:text-slate-400 text-lg relative overflow-hidden">No bookmarks yet. Add your first bookmark above!</div>';
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
    toast.className = `flex items-center gap-4 p-5 rounded-xl shadow-lg mb-4 transform translate-x-full transition-all duration-500 ease-out max-w-md relative overflow-hidden ${getToastClass(type)}`;

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
        return "bg-white dark:bg-slate-800 border-l-4 border-green-500";
      case "error":
        return "bg-white dark:bg-slate-800 border-l-4 border-red-500";
      case "info":
      default:
        return "bg-white dark:bg-slate-800 border-l-4 border-indigo-500";
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
  }

  // Show/hide back to top button based on scroll position
  window.addEventListener("scroll", function () {
    if (window.scrollY > 500) {
      backToTopButton.classList.remove("opacity-0", "translate-y-10");
      backToTopButton.classList.add("opacity-100", "translate-y-0");
    } else {
      backToTopButton.classList.add("opacity-0", "translate-y-10");
      backToTopButton.classList.remove("opacity-100", "translate-y-0");
    }
  });

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
