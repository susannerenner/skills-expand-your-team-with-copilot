const ActivitySharing = {
  getActivityId(name) {
    return `activity-${encodeURIComponent(name)}`;
  },

  createControls(name) {
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set("activity", name);
    const text = `Check out ${name} at Mergington High School!`;
    const controls = document.createElement("div");
    controls.className = "activity-sharing";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", `Share ${name}`);

    const label = document.createElement("span");
    label.textContent = "Share:";
    controls.appendChild(label);

    const destinations = [
      ["WhatsApp", "https://wa.me/", { text: `${text} ${url.href}` }],
      ["Facebook", "https://www.facebook.com/sharer/sharer.php", { u: url.href }],
      ["X", "https://twitter.com/intent/tweet", { text, url: url.href }],
    ];

    destinations.forEach(([platform, destination, parameters]) => {
      const shareUrl = new URL(destination);
      shareUrl.search = new URLSearchParams(parameters).toString();
      const link = document.createElement("a");
      link.textContent = platform;
      link.href = shareUrl.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `Share ${name} on ${platform} (opens a new tab)`);
      controls.appendChild(link);
    });

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copy link";
    copyButton.setAttribute("aria-label", `Copy link to ${name}`);

    const status = document.createElement("span");
    status.className = "share-status";
    status.setAttribute("role", "status");

    const fallback = document.createElement("input");
    fallback.type = "text";
    fallback.readOnly = true;
    fallback.value = url.href;
    fallback.className = "share-link-fallback hidden";
    fallback.setAttribute("aria-label", `Link to ${name}`);

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url.href);
        fallback.classList.add("hidden");
        status.textContent = "Link copied!";
      } catch {
        fallback.classList.remove("hidden");
        fallback.focus();
        fallback.select();
        status.textContent = "Copy the selected link to share this activity.";
      }
    });

    controls.append(copyButton, status, fallback);
    return controls;
  },
};
