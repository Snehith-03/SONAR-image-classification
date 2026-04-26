import React, { useEffect } from 'react';
import { Download, X, Waves } from 'lucide-react';
import './SonarDashboard.css';

const Results = ({ classificationResult, onReset, onBack, onToggleBookmark, isBookmarked }) => {
  useEffect(() => {
    const items = document.querySelectorAll('.classification-item');
    items.forEach((item) => {
      const bar = item.querySelector('.confidence-bar');
      if (bar) {
        const pct = bar.getAttribute('data-pct') || bar.style.width || '0%';
        bar.style.setProperty('--target-width', pct);
      }
    });
  }, [classificationResult]);

  if (!classificationResult) {
    return (
      <div className="results-container results--empty">
        <div className="empty">
          <Waves size={64} color="#64748b" />
          <h2>No Analysis Results</h2>
          <p>Please upload and analyze a SONAR image first</p>
          <button onClick={onBack} className="back-button btn muted">
            Back to Upload
          </button>
        </div>
      </div>
    );
  }

  const downloadResults = () => {
    const blob = new Blob([JSON.stringify(classificationResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${classificationResult.filename.replace(/\.[^/.]+$/, '')}_report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadProcessed = () => {
    const link = document.createElement('a');
    link.href = classificationResult.processed || classificationResult.original;
    link.download = `classified_${classificationResult.filename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="results-container">
      <div className="results-header">
        <div className="header-content">
          <div className="header-title">
            <Waves size={32} color="#60a5fa" />
            <h1>SONAR AI Analysis Results</h1>
          </div>
          <div className="header-actions">
            <button onClick={downloadResults} className="download-button cyan btn">
              <Download size={16} /> Download JSON
            </button>

            <button onClick={downloadProcessed} className="download-button green btn">
              <Download size={16} /> Download Image
            </button>

            <button onClick={onToggleBookmark} className={`bookmark-button ${isBookmarked ? 'amber' : 'purple'} btn`}>
              {isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
            </button>

            <button onClick={onReset} className="reset-button muted btn">
              <X size={16} /> New Analysis
            </button>
          </div>
        </div>
      </div>

      <div className="results-content">
        <div className="results-grid">
          
          {/* LEFT COLUMN */}
          <div className="main-column">

            {/* Description */}
            <div className="analysis-card">
              <h3>AI Analysis Description</h3>
              <div className="description-box">
                <p>{classificationResult.aiDescription}</p>
              </div>
              <p className="description-note">
                Automatically generated description based on AI analysis of sonar imagery
              </p>
            </div>

            {/* Images - Now with 3 images */}
            <div className="images-grid">

              <div className="image-card">
                <h4>Original SONAR Image</h4>
                <div className="image-container">
                  <img src={classificationResult.original} alt="Original sonar scan" />
                </div>
                <div className="image-meta">
                  <span>{classificationResult.filename}</span>
                </div>
              </div>

              {/* Grad-CAM Heatmap */}
              {classificationResult.gradcamHeatmap && (
                <div className="image-card">
                  <h4>Grad-CAM Heatmap</h4>
                  <div className="image-container">
                    <img src={classificationResult.gradcamHeatmap} alt="Grad-CAM heatmap" />
                  </div>
                  <div className="heatmap-legend">
                    <span className="legend-low">Low Activation</span>
                    <div className="legend-colors">
                      <div className="color-blue"></div>
                      <div className="color-green"></div>
                      <div className="color-yellow"></div>
                      <div className="color-red"></div>
                    </div>
                    <span className="legend-high">High Activation</span>
                  </div>
                </div>
              )}

              {/* LIME Explanation */}
              {classificationResult.limeHeatmap && (
                <div className="image-card">
                  <h4>LIME Explanation</h4>
                  <div className="image-container">
                    <img src={classificationResult.limeHeatmap} alt="LIME explanation" />
                  </div>
                  <div className="heatmap-legend">
                    <span className="legend-low">Low Importance</span>
                    <div className="legend-colors">
                     
                    </div>
                    <span className="legend-high">High Importance</span>
                  </div>
                </div>
              )}

            </div>

            <div className="metadata-card">
              <h4>SONAR Parameters</h4>

              <div className="metadata-grid">
                <div className="metadata-item">
                  <span className="metadata-label">Processed:</span>
                  <span className="metadata-value">
                    {classificationResult.metadata.timestamp}
                  </span>
                </div>

                <div className="metadata-item">
                  <span className="metadata-label">Uploaded By:</span>
                  <span className="metadata-value">
                    {classificationResult.metadata.uploadedBy}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="sidebar-column">

            <div className="classifications-card">
              <h4>AI Classifications</h4>
              <div className="classifications-list">
                {classificationResult.classifications.map((classification, index) => (
                  <div className="classification-item" key={index}>
                    <div className="classification-header">
                      <div className="classification-info">
                        <div className="classification-icon">{classification.icon}</div>
                        <span className="classification-name">{classification.category}</span>
                      </div>
                      <span className="classification-confidence">
                        {Number(classification.confidence).toFixed(1)}%
                      </span>
                    </div>

                    <div className="confidence-bar-bg">
                      <div
                        className="confidence-bar"
                        data-pct={`${classification.confidence}%`}
                        style={{ width: `${classification.confidence}%` }}
                      />
                    </div>

                  </div>
                ))}
              </div>
            </div>

            <div className="summary-card">
              <h4>Analysis Summary</h4>
              <div className="summary-list">
                <div className="summary-item">
                  <span className="summary-label">Primary Detection:</span>
                  <span className="summary-value">
                    {classificationResult.classifications[0]?.category || '—'}
                  </span>
                </div>

                <div className="summary-item">
                  <span className="summary-label">Confidence Level:</span>
                  <span className="summary-value high-confidence">
                    {classificationResult.classifications[0]?.confidence?.toFixed(1)}%
                  </span>
                </div>

                <div className="summary-item">
                  <span className="summary-label">Model Version:</span>
                  <span className="summary-value">v2.1.4</span>
                </div>
              </div>
            </div>

          </div>  

        </div>
      </div>
    </div>
  );
};

export default Results;