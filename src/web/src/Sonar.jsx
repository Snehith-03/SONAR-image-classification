import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";

import {
  Upload, Home, Clock, LogOut, Loader2, X,
  Fish, Ship, Mountain, AlertCircle, User, Plane, BookOpen,
  Satellite, Search
} from "lucide-react";

import Results from "./Results";
import "./SonarDashboard.css";

const formatDate = (d = new Date()) => new Date(d).toLocaleString();

export default function Sonar() {

  const [username, setUsername] = useState(null);

  useEffect(() => {
    const u = localStorage.getItem("username");
    setUsername(u);
  }, []);

  const isUserReady = username !== null;

  const [currentPage, setCurrentPage] = useState("home");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [classificationResult, setClassificationResult] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [history, setHistory] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fileInputRef = useRef(null);
  const API_BASE = "http://localhost:3001";

  const fetchHistory = async () => {
    const token = localStorage.getItem("jwt");
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/user/images`, {
        headers: { Authorization: "Bearer " + token },
      });

      const data = await res.json();
      setHistory(data.images || []);
    } catch (err) {
      console.error("History fetch error:", err);
    }
  };

  useEffect(() => {
    if (isUserReady) fetchHistory();
  }, [isUserReady]);

  useEffect(() => {
    if (!isUserReady) return;
    const saved = localStorage.getItem(`sonar_bookmarks_${username}`);
    setBookmarks(saved ? JSON.parse(saved) : []);
  }, [isUserReady, username]);

  useEffect(() => {
    if (!isUserReady) return;
    localStorage.setItem(`sonar_bookmarks_${username}`, JSON.stringify(bookmarks));
  }, [bookmarks, username, isUserReady]);

  const processImage = async (file, imgDataUrl) => {
    setIsProcessing(true);
    setUploadError("");
    setShowResults(false);

    try {
      const token = localStorage.getItem("jwt");
      if (!token) throw new Error("No auth token found");

      const formData = new FormData();
      formData.append("image", file);
      formData.append("name", file.name);

      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const raw = await response.json();
      const data = raw.model_prediction;

      const mappedClasses = [
        {
          category: data.label,
          confidence: data.probability * 100,
          icon:
            data.label === "ship" ? <Ship size={14} /> :
            data.label === "fish" ? <Fish size={14} /> :
            data.label === "mine" ? <AlertCircle size={14} /> :
            data.label === "plane" ? <Plane size={14} /> :
            data.label === "human" ? <User size={14} /> :
            data.label === "seafloor" ? <Mountain size={14} /> :
            null,
        }
      ];

      const finalResult = {
        original: imgDataUrl,
        processed: imgDataUrl,
        gradcamHeatmap: `data:image/png;base64,${data.gradcam_image_base64}`,
        limeHeatmap: `data:image/png;base64,${data.lime_image_base64}`,
        filename: file.name,
        aiDescription: `${data.label.toUpperCase()} detected with ${(data.probability * 100).toFixed(1)}% confidence`,
        classifications: mappedClasses,
        metadata: { timestamp: formatDate(), uploadedBy: username },
      };

      setClassificationResult(finalResult);
      setShowResults(true);

      await fetchHistory();
    } catch (err) {
      console.error(err);
      setUploadError("Prediction failed — check backend.");
    }

    setIsProcessing(false);
  };

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgDataUrl = e.target.result;
        setUploadedImage(imgDataUrl);
        processImage(file, imgDataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const clearUpload = () => {
    setUploadedImage(null);
    setShowResults(false);
    setClassificationResult(null);
    setUploadError("");
  };

  const deleteHistoryImage = async (name) => {
    const token = localStorage.getItem("jwt");
    if (!token) return;

    await fetch(`${API_BASE}/user/image/${name}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });

    await fetchHistory();
  };

  const deleteAllHistory = async (downloadZip) => {
    const token = localStorage.getItem("jwt");
    if (!token) return;

    if (downloadZip && history.length > 0) {
      const zip = new JSZip();
      history.forEach((img) => {
        zip.file(`${img.name}.jpg`, img.data, { binary: true });
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sonar_backup_${username}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }

    await fetch(`${API_BASE}/user/images`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });

    await fetchHistory();
    setShowDeleteModal(false);
  };

  const downloadHistoryImage = async (name) => {
    const token = localStorage.getItem("jwt");
    const res = await fetch(`${API_BASE}/user/image/${name}`, {
      headers: { Authorization: "Bearer " + token },
    });

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleBookmark = () => {
    if (!classificationResult) return;
    setBookmarks((prev) => {
      const exists = prev.find((b) => b.filename === classificationResult.filename);
      if (exists) return prev.filter((b) => b.filename !== classificationResult.filename);
      return [{ ...classificationResult, bookmarkedAt: new Date().toISOString() }, ...prev];
    });
  };

  const isCurrentBookmarked = () =>
    bookmarks.some((b) => b.filename === classificationResult?.filename);

  const handleLogout = () => {
    localStorage.removeItem("jwt");
    localStorage.removeItem("username");
    localStorage.removeItem(`privKey_${username}`);
    window.location.reload();
  };

  if (!isUserReady) {
    return <div></div>;
  }

  const Navbar = ({ currentPage, onNavigate }) => (
  <nav className="navbar">
    <div className="nav-container">
      <div className="nav-left">
        <div className="logo-wrapper">
          <div className="logo-box"><Satellite size={20} /></div>
        </div>
        <div className="logo-text">
          <div className="brand">SONAR AI</div>
          <div className="brand-sub">{username}</div>
        </div>
      </div>

      <div className="nav-right">
        <button
          className={`nav-button ${currentPage === "home" ? "active" : ""}`}
          onClick={(e) => onNavigate("home", e)}
        >
          <Home size={14} /> <span>Dashboard</span>
        </button>

        <button
          className={`nav-button ${currentPage === "history" ? "active" : ""}`}
          onClick={(e) => onNavigate("history", e)}
        >
          <Clock size={14} /> <span>History</span>
        </button>

        <button
          className={`nav-button ${currentPage === "bookmarks" ? "active" : ""}`}
          onClick={(e) => onNavigate("bookmarks", e)}
        >
          <BookOpen size={14} /> <span>Bookmarks</span>
        </button>

        <button className="nav-button logout" onClick={handleLogout}>
          <LogOut size={14} /> <span>Logout</span>
        </button>
      </div>
    </div>
  </nav>
);

  const HistoryPage = () => (
    <div className="history-page">
      <div className="history-header">
        <h3>Classification History</h3>

        {history.length > 0 && (
          <button className="btn muted" style={{ backgroundColor: "#ff4d4d", color: "white" }}
            onClick={() => setShowDeleteModal(true)}>
            Delete All
          </button>
        )}
      </div>

      {!history.length ? (
        <div className="empty">No history yet — analyze something.</div>
      ) : (
        <div className="history-list">
          {history.map((h, idx) => (
            <div key={idx} className="history-item">
              <div className="history-main">
                <div className="history-filename">{h.name}</div>
                <div className="history-time">{formatDate(h.uploadedAt)}</div>
              </div>

              <div className="history-ops">
                <button className="btn cyan" onClick={() => downloadHistoryImage(h.name)}>
                  Download
                </button>

                <button className="btn muted" style={{ backgroundColor: "#ff4d4d", color: "white" }}
                  onClick={() => deleteHistoryImage(h.name)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete all images?</h3>
            <p>Download ZIP backup before deleting everything?</p>

            <div className="modal-actions">
              <button className="btn green" onClick={() => deleteAllHistory(true)}>
                Download ZIP & Delete
              </button>

              <button className="btn muted" onClick={() => deleteAllHistory(false)}>
                Delete Without Saving
              </button>

              <button className="btn muted" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const BookmarksPage = () => (
    <div className="bookmarks-page">
      <div className="bookmarks-header">
        <h3>Bookmarks</h3>
        <button className="btn muted" onClick={() => setBookmarks([])}>Clear All</button>
      </div>

      {!bookmarks.length ? (
        <div className="empty">No bookmarks yet.</div>
      ) : (
        <div className="bookmarks-list">
          {bookmarks.map((b, idx) => (
            <div key={idx} className="bookmark-item">
              <div className="bookmark-main">
                <div className="bookmark-filename">{b.filename}</div>
                <div className="bookmark-time">{formatDate(b.bookmarkedAt)}</div>
              </div>

              <div className="bookmark-ops">
                <button className="btn cyan" onClick={() => {
                  setClassificationResult(b);
                  setShowResults(true);
                  setCurrentPage("home");
                }}>
                  Open
                </button>

                <button className="btn muted"
                  onClick={() =>
                    setBookmarks((prev) => prev.filter((x) => x.filename !== b.filename))
                  }>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="sonar-dashboard">
      <Navbar
        username={username}
        onNavigate={(p, e) => {
          if (p === "history")
            fetchHistory();

          setCurrentPage(p);
          setShowResults(false);

          const rect = e?.currentTarget?.getBoundingClientRect();

          const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
          const y = rect ? rect.top + rect.height : window.innerHeight / 2;

          document.dispatchEvent(
          new CustomEvent("page-change", {
          detail: { x, y },
        })
    );
  }}
        currentPage={currentPage}
      />

      <main className="main-content">
        {showResults && classificationResult ? (
          <Results
            classificationResult={classificationResult}
            onReset={() => {
              setShowResults(false);
              clearUpload();
            }}
            onBack={() => {
              setShowResults(false);
              setCurrentPage("home");
            }}
            onToggleBookmark={toggleBookmark}
            isBookmarked={isCurrentBookmarked()}
          />
        ) : (
          <>
            {currentPage === "home" && (
              <div className="home-page">
                <header className="page-header" style={{ marginLeft: "-30px" }}>
                  <div className="header-left">
                    <Search size={20} />
                    <div>
                      <h3>SONAR image classification</h3>
                      <p className="subtitle">
                        Hello, {username}. You can upload SONAR images for classification and explanation.
                      </p>
                    </div>
                  </div>
                </header>

                <section
                  className={`upload-zone ${isDragging ? "is-dragging" : ""} ${uploadedImage ? "has-image" : ""}`}
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    className="file-input"
                  />

                  {!uploadedImage ? (
                    <div className="upload-prompt">
                      <Upload size={64} />
                      <h3>Upload SONAR Image</h3>
                      <p>Click or drag and drop to analyze</p>
                      {uploadError && <p className="text--error">{uploadError}</p>}
                    </div>
                  ) : (
                    <div className="preview-area">
                      <div className="preview-image-wrap">
                        <img className="preview-image" src={uploadedImage} alt="preview" />
                        <button
                          className="clear-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearUpload();
                          }}
                        >
                          <X size={16} />
                        </button>

                        {isProcessing && (
                          <div className="processing-overlay">
                            <Loader2 className="spin" />
                            <span>Analyzing...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {currentPage === "history" && <HistoryPage />}
            {currentPage === "bookmarks" && <BookmarksPage />}
          </>
        )}
      </main>
    </div>
  );
}