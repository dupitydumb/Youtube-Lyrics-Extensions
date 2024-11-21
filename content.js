let plainLyrics = "I'm sorry, I cannot find the lyrics for this song.";
let syncLyrics = [];
let isSyncLyrics = false;
let artistNameElement = "";
let delay = 0;
window.onload = function () {
  const currentURL = window.location.href;
  // Allow the extension to run only on YouTube video URLs
  const videoURLPattern = /^https:\/\/www\.youtube\.com\/watch\?v=/;
  let hasRun = false;
  if (videoURLPattern.test(currentURL)) {
    console.log("This is a YouTube video page");
    injectTailwindCSS();
    const observer = new MutationObserver((mutations, obs) => {
      const itemsDiv = document.querySelector("#secondary-inner");
      if (itemsDiv && !hasRun) {
        console.log(itemsDiv);
        const videoTitleElement = document.querySelector(
          "#title > h1 > yt-formatted-string"
        );
        artistNameElement = document.querySelector("#text").innerText;
        console.log("Artist name:", artistNameElement);
        const videoTitle = videoTitleElement
          ? videoTitleElement.textContent + " |" + artistNameElement
          : "No title found";
        // Extract the video title
        console.log("Video title:", formattedTitle(videoTitle));
        getLyrics(formattedTitle(videoTitle));
        createNewDiv(itemsDiv);
        // Create style if isSyncLyrics is true
        hasRun = true;
        obs.disconnect(); // Stop observing once the target element is found
      }
    });

    // Start observing the document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
};
let hasTryAgain = false;
let datas = [];
function getLyrics(title) {
  let url = "https://lrclib.net/api/search?q=" + title;
  if (hasTryAgain) {
    url = "https://lrclib.net/api/search?q=" + title;
  }
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      if (data.length === 0 && !hasTryAgain) {
        getLyrics(formattedSongTitleOnly(title));
        hasTryAgain = true;
        return;
      }
      if (data.length > 0) {
        datas = data;
        let selectedData = searchData(artistNameElement);
        console.log("Data : " + selectedData);
        plainLyrics = selectedData.plainLyrics;
        syncLyrics = parseSyncLyrics(selectedData.syncedLyrics);
        updateTitle(selectedData.trackName + " - " + selectedData.artistName);
        generateSyncLyrics();
        var lyricsTypeSelect = document.querySelector("select");
        console.log(plainLyrics);
        console.log(syncLyrics);
        if (syncLyrics.length > 0 && syncLyrics[0] !== null) {
          isSyncLyrics = true;
          //Set the default value to current isSyncLyrics value
          lyricsTypeSelect.value = "sync";
          startSyncLyrics();
        } else {
          isSyncLyrics = false;
          //Set the default value to current isSyncLyrics value
          lyricsTypeSelect.value = "plain";
          console.log(syncLyrics[0]);
          console.log("syncLyrics is empty");
          setLyrics(plainLyrics);
        }
      } else {
      }
    })
    .catch((error) => {
      startSyncLyrics();
      if (syncLyrics.length > 0) {
        startSyncLyrics();
      } else {
        setLyrics(plainLyrics);
        console.error("Error:", error);
      }
    });
}

function searchData(artistName) {
  for (let i = 0; i < datas.length; i++) {
    //If artistNameElement is close to the artistName in the data, return the data
    if (datas[i].artistName.includes(artistName)) {
      return datas[i];
    } else {
      return datas[0];
    }
  }
}

function formattedTitle(title) {
  const notallowed = [
    "official",
    "video",
    "lyric",
    "music",
    "audio",
    "mv",
    "M/V",
    "(Official Video)",
  ];
  //Add all korean characters to the not allowed list
  for (let i = 44032; i <= 55203; i++) {
    notallowed.push(String.fromCharCode(i));
  }
  //Remove the not allowed words from the title
  let formattedTitle = title.toLowerCase().split(" ");
  formattedTitle = formattedTitle
    .filter((word) => !notallowed.includes(word))
    .join(" ");

  // If the title has a pipe, remove the text after the pipe
  if (formattedTitle.includes("|") && formattedTitle.includes("-")) {
    formattedTitle = formattedTitle.split("|")[0];
  }
  console.log("Formatted title:", formattedTitle);
  return formattedTitle;
}

function formattedSongTitleOnly(title) {
  //if title has a dash remove the text before the dash
  if (title.includes("-")) {
    title = title.split("-")[1];
  }
  return title;
}
let isVideoPlaying = false;
function startSyncLyrics() {
  if (!isSyncLyrics) {
    return;
  }
  const videoElement = document.getElementsByTagName("video")[0];
  videoElement.addEventListener("play", () => {
    isVideoPlaying = true;
  });
  videoElement.addEventListener("pause", () => {
    isVideoPlaying = false;
  });
  videoElement.addEventListener("timeupdate", () => {
    if (isVideoPlaying) {
      updateLyrics();
    }
  });

  isSyncLyrics = true;
  const style = document.createElement("style");
  style.textContent = `
            #Lyric-Body {
                font-size: 26px;
                font-weight: bold;    
                margin: 0;
                padding: 8px;
                transition: color 0.5s;
                text-align: center;
            }
            #Lyric-Body p {
                animation: glow 1s ease-in-out infinite alternate;
                text-shadow: 0px 15px 26px rgba(0,0,0,0.6);
                margin: 0;
                padding: 8px;
            }
            `;
  document.head.appendChild(style);
  function updateLyrics() {
    console.log("Checking for current lyric");
    const currentTime = getCurrentVideoTime() + delay;
    if (currentTime !== null) {
      const currentLyric = syncLyrics.find(
        (lyric) => lyric.time <= currentTime && lyric.time + 2 >= currentTime
      );
      console.log("Current time:", currentTime);
      if (currentLyric) {
        console.log("Setting current lyric to", currentLyric.text);
        setSyncLyrics(currentLyric.text);
      } else {
        //if the currentLyric is not found, set current lyric to the closest lyric with time less than current time
        // const closestLyric = syncLyrics.reduce((a, b) =>
        //   Math.abs(b.time - currentTime) < Math.abs(a.time - currentTime)
        //     ? b
        //     : a
        // );
        // console.log("Setting current lyric to", closestLyric.text);
        // setSyncLyrics(closestLyric.text);
      }
    }
  }
}

function parseSyncLyrics(syncedLyrics) {
  const lines = syncedLyrics.split("\n");
  return lines
    .map((line) => {
      const match = line.match(/\[(\d{2}:\d{2}\.\d{2})\] (.*)/);
      if (match) {
        const timeParts = match[1].split(":");
        const timeInSeconds =
          parseInt(timeParts[0]) * 60 + parseFloat(timeParts[1]);
        return { time: timeInSeconds, text: match[2] };
      }
      return null;
    })
    .filter((line) => line !== null);
}
function updateTitle(title) {
  const titleElement = document.querySelector("#Lyric-Title");
  if (titleElement) {
    titleElement.textContent = title;
  }
}

function createNewDiv(itemsDiv) {
  const videoTitleElement = document.querySelector(
    "#title > h1 > yt-formatted-string"
  );
  const videoTitle = videoTitleElement
    ? videoTitleElement.textContent
    : "No title found";
  const newDiv = document.createElement("div");
  newDiv.id = "Lyric-Panel";
  // Add CSS for #Lyric-Panel
  itemsDiv.prepend(newDiv);

  //Create title for the lyrics panel
  const title = document.createElement("h2");
  title.textContent = `${videoTitle}`;
  title.id = "Lyric-Title";
  title.style.textAlign = "center";
  title.style.fontSize = "24px";
  title.style.marginBottom = "16px";
  newDiv.prepend(title);
  // Add the new div to the document body for lyrics
  const lyricBody = document.createElement("div");
  lyricBody.id = "Lyric-Body";
  newDiv.appendChild(lyricBody);
  // Add delay control panel
  const secondaryInner = document.querySelector("#secondary-inner");
  const settingPanel = document.createElement("div");
  settingPanel.className =
    "mt-2 p-2 bg-gray-100 rounded-lg shadow-md flex flex-col items-left";
  //
  //Make setting panell. contains delay control, lyrics type control. and lyrics language control
  const delayPanel = document.createElement("div");
  delayPanel.className = "flex flex-row items-center";
  const delayLabel = document.createElement("label");
  delayLabel.textContent = "Delay (s):";
  delayLabel.className = "mr-2";
  const delayInput = document.createElement("input");
  delayInput.type = "number";
  delayInput.value = 0;
  delayInput.min = -10;
  delayInput.max = 10;
  delayInput.className =
    "border border-gray-300 rounded-lg p-1 focus:outline-none";
  delayInput.addEventListener("input", (e) => {
    delay = parseInt(e.target.value);
  });
  settingPanel.appendChild(delayLabel);
  settingPanel.appendChild(delayInput);

  //Switch between plain lyrics and sync lyrics
  const lyricsTypePanel = document.createElement("div");
  lyricsTypePanel.className = "flex flex-row items-center";
  const lyricsTypeLabel = document.createElement("label");
  lyricsTypeLabel.textContent = "Lyrics Type:";
  lyricsTypeLabel.className = "mr-2";
  const lyricsTypeSelect = document.createElement("select");
  lyricsTypeSelect.className =
    "border border-gray-300 rounded-lg p-1 focus:outline-none";
  const plainLyricsOption = document.createElement("option");
  plainLyricsOption.value = "plain";
  plainLyricsOption.textContent = "Plain Lyrics";
  const syncLyricsOption = document.createElement("option");
  syncLyricsOption.value = "sync";
  syncLyricsOption.textContent = "Synced Lyrics";
  lyricsTypeSelect.appendChild(plainLyricsOption);
  lyricsTypeSelect.appendChild(syncLyricsOption);
  lyricsTypeSelect.addEventListener("change", (e) => {
    if (e.target.value === "sync") {
      isSyncLyrics = true;
    } else {
      isSyncLyrics = false;
    }
  });
  lyricsTypePanel.appendChild(lyricsTypeLabel);
  lyricsTypePanel.appendChild(lyricsTypeSelect);
  settingPanel.appendChild(lyricsTypePanel);
  secondaryInner.insertBefore(settingPanel, secondaryInner.childNodes[1]);
  const style = document.createElement("style");
  style.textContent = `
        #Lyric-Panel {
          background-color: #f9fafb; /* Light gray background */
          padding: 16px; /* Padding */
          margin: 8px 0; /* Margin */
          border: 1px solid #e5e7eb; /* Border */
          border-radius: 8px; /* Rounded corners */
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); /* Shadow */
          font-family: 'Arial', sans-serif; /* Font */
          color: #374151; /* Text color */
          text-align: left; /* Text alignment */
          font-size: 24px; /* Font size */
        }
        #Lyric-Body {
          max-height: 300px; /* Fixed height */
          overflow-y: auto; /* Scrollable */
          padding: 8px; /* Padding */
          background-color: #ffffff; /* White background */
          border-top: 1px solid #e5e7eb; /* Top border */
          font-size: 16px; /* Font size */
        }
      `;
  document.head.appendChild(style);
}

function injectTailwindCSS() {
  const link = document.createElement("link");
  link.href =
    "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css";
  link.rel = "stylesheet";
  document.head.appendChild(link);
}

function setLyrics(lyrics) {
  const lyricPanel = document.querySelector("#Lyric-Body");
  if (lyricPanel) {
    // Clear existing content
    lyricPanel.innerHTML = "";

    // Split lyrics by line breaks and create a new paragraph for each line
    const lines = lyrics.split("\n");
    lines.forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      lyricPanel.appendChild(p);
    });
  }
}

function setSyncLyrics(lyrics) {
  const lyricPanel = document.querySelector("#Lyric-Body");
  if (lyricPanel) {
    //One lyric before and after the current lyric
    const currentIndex = syncLyrics.findIndex((lyric) => lyric.text === lyrics);
    const previousLyric = syncLyrics[currentIndex - 1];
    const currentLyric = syncLyrics[currentIndex];
    const nextLyric = syncLyrics[currentIndex + 1];

    if (previousLyric < 0) {
      previousLyric = syncLyrics[0];
    }

    if (nextLyric < 0) {
      nextLyric = syncLyrics[syncLyrics.length - 1];
    }

    // sync the lyricsElement with the currentLyric based on the index
    lyricElements.forEach((element) => {
      element.style.opacity = "0.2";
    });
    lyricElements[currentIndex].style.opacity = "1";
    //Change opacity of the previous and next lyric
    if (previousLyric) {
      lyricElements[currentIndex - 1].style.opacity = "0.2";
    }
    if (nextLyric) {
      lyricElements[currentIndex + 1].style.opacity = "0.2";
    }

    //Set the current lyric to the center of the panel
    lyricPanel.scrollTop = lyricElements[currentIndex].offsetTop - 200;
  }
}

//New list of lyrics elements
let lyricElements = [];
function generateSyncLyrics() {
  for (let i = 0; i < syncLyrics.length; i++) {
    const lyricPanel = document.querySelector("#Lyric-Body");
    const p = document.createElement("p");
    p.textContent = syncLyrics[i].text;
    lyricPanel.appendChild(p);
    lyricElements.push(p);
    //create style for the lyric elements
    const style = document.createElement("style");
    style.textContent = `
            #Lyric-Body p {
                transition: color 0.5s;

            }
            `;
    document.head.appendChild(style);
  }
}

function getCurrentVideoTime() {
  return document.getElementsByTagName("video")[0].currentTime;
}
