document.addEventListener("DOMContentLoaded", async () => {
  // Get DOM elements
  const loadingElement = document.getElementById("loading");
  const errorElement = document.getElementById("error");
  const bookmarkForm = document.getElementById("bookmarkForm");
  const successElement = document.getElementById("success");

  const titleInput = document.getElementById("title");
  const descriptionInput = document.getElementById("description");
  const tagsInput = document.getElementById("tags");
  const previewImage = document.getElementById("previewImage");
  const noImageText = document.getElementById("noImageText");
  const apiUrlInput = document.getElementById("apiUrl");

  const saveButton = document.getElementById("saveButton");
  const cancelButton = document.getElementById("cancelButton");
  const doneButton = document.getElementById("doneButton");

  // Helper function to show/hide elements
  function showElement(element) {
    if (element === loadingElement) {
      element.style.display = "flex";
    } else if (element === bookmarkForm) {
      element.style.display = "block";
    } else if (element === successElement) {
      element.style.display = "flex";
    } else {
      element.style.display = "block";
    }
  }

  function hideElement(element) {
    element.style.display = "none";
  }

  // Get active tab
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Load API URL from storage
  chrome.storage.sync.get(["apiUrl"], (result) => {
    if (result.apiUrl) {
      apiUrlInput.value = result.apiUrl;
    } else {
      apiUrlInput.value = "http://localhost:3000";
    }
  });

  // Initialize page metadata
  let metadata = {
    url: tab.url,
    title: tab.title,
    description: "",
    image_url: null,
  };

  try {
    // Fetch page metadata from your API
    const apiUrl = apiUrlInput.value || "http://localhost:3000";

    const metadataResponse = await fetch(`${apiUrl}/api/fetch-metadata`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: tab.url }),
    });

    if (!metadataResponse.ok) {
      throw new Error("Failed to fetch page metadata");
    }

    const fetchedMetadata = await metadataResponse.json();

    // Update metadata with fetched data
    metadata = {
      url: tab.url,
      title: fetchedMetadata.title || tab.title,
      description: fetchedMetadata.description || "",
      image_url: fetchedMetadata.image || null,
    };

    // Populate form
    titleInput.value = metadata.title;
    descriptionInput.value = metadata.description;

    // Show image preview if available
    if (metadata.image_url) {
      previewImage.src = metadata.image_url;
      previewImage.style.display = "block";
      noImageText.style.display = "none";
    }

    // Show form
    hideElement(loadingElement);
    showElement(bookmarkForm);
  } catch (error) {
    console.error("Error fetching metadata:", error);

    // Show fallback data
    titleInput.value = tab.title;

    // Show form with basic data
    hideElement(loadingElement);
    showElement(bookmarkForm);

    // Show error message
    errorElement.textContent =
      "Could not fetch page details. You can still edit and save the bookmark.";
    showElement(errorElement);
  }

  // Handle form submission
  bookmarkForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Save API URL to storage
    chrome.storage.sync.set({ apiUrl: apiUrlInput.value });

    // Disable save button and show loading state
    saveButton.disabled = true;
    saveButton.innerHTML = `
      <div class="spinner-loading"></div>
      Saving...
    `;

    try {
      // Prepare bookmark data
      const bookmarkData = {
        url: tab.url,
        title: titleInput.value,
        description: descriptionInput.value,
        image_url: metadata.image_url,
        tags: tagsInput.value
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag !== ""),
      };

      // Save bookmark
      const apiUrl = apiUrlInput.value || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/api/bookmarks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookmarkData),
      });

      if (!response.ok) {
        throw new Error("Failed to save bookmark");
      }

      // Show success message
      hideElement(bookmarkForm);
      showElement(successElement);
    } catch (error) {
      console.error("Error saving bookmark:", error);

      // Show error message
      errorElement.textContent = "Failed to save bookmark. Please try again.";
      showElement(errorElement);

      // Reset save button
      saveButton.disabled = false;
      saveButton.textContent = "Save Bookmark";
    }
  });

  // Handle cancel button
  cancelButton.addEventListener("click", () => {
    window.close();
  });

  // Handle done button
  doneButton.addEventListener("click", () => {
    window.close();
  });
});
