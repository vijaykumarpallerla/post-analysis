document.addEventListener('DOMContentLoaded', () => {
    const addPostBtn = document.getElementById('addPostBtn');
    const postModal = document.getElementById('postModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const postText = document.getElementById('postText');
    const mediaDescription = document.getElementById('mediaDescription');
    const submitPostBtn = document.getElementById('submitPostBtn');
    const postDate = document.getElementById('postDate');
    const postTime = document.getElementById('postTime');
    const postsContainer = document.getElementById('postsContainer');
    const emptyState = document.getElementById('emptyState');
    
    const metricsModal = document.getElementById('metricsModal');
    const closeMetricsModalBtn = document.getElementById('closeMetricsModalBtn');
    const submitMetricsBtn = document.getElementById('submitMetricsBtn');
    const metricDate = document.getElementById('metricDate');
    const metricTime = document.getElementById('metricTime');
    const metricReactions = document.getElementById('metricReactions');
    const metricComments = document.getElementById('metricComments');
    const metricReposts = document.getElementById('metricReposts');
    const metricImpressions = document.getElementById('metricImpressions');
    
    const metricsHistoryModal = document.getElementById('metricsHistoryModal');
    const closeMetricsHistoryBtn = document.getElementById('closeMetricsHistoryBtn');
    const historyTableBody = document.getElementById('historyTableBody');
    const noHistoryMessage = document.getElementById('noHistoryMessage');
    const historyTable = document.getElementById('historyTable');
    
    let currentMetricsPostId = null;
    let editingPostId = null;
    
    // Image & Document handling
    const imageBtn = document.getElementById('imageBtn');
    const imageInput = document.getElementById('imageInput');
    const documentBtn = document.getElementById('documentBtn');
    const documentInput = document.getElementById('documentInput');

    // Open Modal
    addPostBtn.addEventListener('click', () => {
        postModal.classList.add('active');
        postText.focus();
    });

    // Close Modal
    const closeModal = () => {
        postModal.classList.remove('active');
        // Reset fields when closing
        setTimeout(() => {
            postText.value = '';
            mediaDescription.value = '';
            postDate.value = '';
            postTime.value = '';
            submitPostBtn.disabled = true;
            imageInput.value = '';
            documentInput.value = '';
            imageBtn.style.color = '';
            documentBtn.style.color = '';
            
            editingPostId = null;
            submitPostBtn.innerText = 'Save';
        }, 300);
    };

    closeModalBtn.addEventListener('click', closeModal);

    // Enable/Disable post button based on text input
    postText.addEventListener('input', () => {
        if (postText.value.trim().length > 0) {
            submitPostBtn.disabled = false;
        } else {
            submitPostBtn.disabled = true;
        }
    });

    // Image & Document upload click handler
    imageBtn.addEventListener('click', () => {
        imageInput.click();
    });
    
    documentBtn.addEventListener('click', () => {
        documentInput.click();
    });

    const fetchPosts = async () => {
        try {
            const res = await fetch('/api/posts');
            const result = await res.json();
            if (result.status === 'success') {
                renderPosts(result.data);
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
        }
    };

    const renderPosts = (posts) => {
        postsContainer.innerHTML = '';
        
        if (posts.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }
        
        emptyState.style.display = 'none';
        
        posts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'post-card';
            
            const dateStr = post.posted_at || post.created_at;
            const dateObj = new Date(dateStr);
            const formattedDate = dateObj.toLocaleString(undefined, { 
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute:'2-digit'
            });
            
            let mediaHtml = '';
            if (post.image_url) {
                mediaHtml += `<img src="${post.image_url}" alt="Post image" class="post-image">`;
            }
            if (post.document_url) {
                mediaHtml += `
                    <div class="post-document">
                        <i class="fa-regular fa-file-pdf"></i>
                        <a href="${post.document_url}" target="_blank">View Document</a>
                    </div>
                `;
            }
            if (post.media_description) {
                mediaHtml += `
                    <div class="media-description" style="margin-top: 8px; padding: 12px; background-color: #f8f9fa; border-left: 3px solid var(--primary); border-radius: 4px; font-size: 13px; color: var(--text-main);">
                        <strong>AI Context:</strong> ${escapeHtml(post.media_description)}
                    </div>
                `;
            }
            
            card.innerHTML = `
                <div class="post-card-header">
                    <span class="post-date"><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
                    <div>
                        <button class="btn-delete tooltip" style="margin-right: 4px; color: var(--primary);" data-tooltip="Edit Post" onclick='editPost(${JSON.stringify(post).replace(/'/g, "&#39;")})'>
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-delete tooltip" data-tooltip="Delete Post" onclick="deletePost(${post.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="post-text collapsed" id="post-text-${post.id}">${escapeHtml(post.text)}</div>
                <button class="see-more-btn" id="see-more-${post.id}" onclick="toggleText(${post.id})">...see more</button>
                ${mediaHtml}
                <div class="post-actions">
                    <button class="btn-secondary" onclick="openMetricsHistory(${post.id})">
                        <i class="fa-solid fa-clock-rotate-left"></i> History
                    </button>
                    <button class="btn-secondary" onclick="openMetricsModal(${post.id})">
                        <i class="fa-solid fa-chart-simple"></i> Log Stats
                    </button>
                </div>
            `;
            
            postsContainer.appendChild(card);
            
            // Show "see more" button only if text is truncated
            setTimeout(() => {
                const textEl = document.getElementById(`post-text-${post.id}`);
                const btnEl = document.getElementById(`see-more-${post.id}`);
                if (textEl && btnEl && textEl.scrollHeight > textEl.clientHeight) {
                    btnEl.style.display = 'block';
                }
            }, 0);
        });
    };
    
    const escapeHtml = (unsafe) => {
        return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    window.toggleText = (id) => {
        const textEl = document.getElementById(`post-text-${id}`);
        const btnEl = document.getElementById(`see-more-${id}`);
        if (textEl && btnEl && textEl.classList.contains('collapsed')) {
            textEl.classList.remove('collapsed');
            btnEl.style.display = 'none';
        }
    };
    
    window.editPost = (post) => {
        editingPostId = post.id;
        postText.value = post.text || '';
        
        if (post.media_description) {
            mediaDescription.value = post.media_description;
        } else {
            mediaDescription.value = '';
        }
        
        const timeToEdit = post.posted_at || post.created_at;
        if (timeToEdit) {
            const dateObj = new Date(timeToEdit);
            if (!isNaN(dateObj.getTime())) {
                const yyyy = dateObj.getFullYear();
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(dateObj.getDate()).padStart(2, '0');
                postDate.value = `${yyyy}-${mm}-${dd}`;
                
                const hh = String(dateObj.getHours()).padStart(2, '0');
                const min = String(dateObj.getMinutes()).padStart(2, '0');
                postTime.value = `${hh}:${min}`;
            } else {
                postDate.value = '';
                postTime.value = '';
            }
        } else {
            postDate.value = '';
            postTime.value = '';
        }
        
        postModal.classList.add('active');
        submitPostBtn.disabled = false;
        submitPostBtn.innerText = 'Update Post';
        postText.focus();
    };

    window.deletePost = async (id) => {
        if (!confirm('Are you sure you want to delete this post?')) return;
        
        try {
            const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.status === 'success') {
                fetchPosts();
            } else {
                alert('Failed to delete post.');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            alert('Error deleting post.');
        }
    };

    window.openMetricsHistory = async (postId) => {
        metricsHistoryModal.classList.add('active');
        historyTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';
        historyTable.style.display = 'table';
        noHistoryMessage.style.display = 'none';
        
        try {
            const res = await fetch(`/api/posts/${postId}/metrics`);
            const result = await res.json();
            
            if (result.status === 'success') {
                if (result.data.length === 0) {
                    historyTable.style.display = 'none';
                    noHistoryMessage.style.display = 'block';
                } else {
                    historyTableBody.innerHTML = '';
                    result.data.forEach(log => {
                        const dateStr = log.observed_at || log.created_at;
                        const dateObj = new Date(dateStr);
                        const formattedDate = dateObj.toLocaleString(undefined, { 
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute:'2-digit'
                        });
                        
                        historyTableBody.innerHTML += `
                            <tr>
                                <td>${formattedDate}</td>
                                <td>${log.reactions}</td>
                                <td>${log.comments}</td>
                                <td>${log.reposts}</td>
                                <td>${log.impressions}</td>
                            </tr>
                        `;
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching history:', error);
            historyTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#d32f2f;">Error loading history</td></tr>';
        }
    };
    
    closeMetricsHistoryBtn.addEventListener('click', () => {
        metricsHistoryModal.classList.remove('active');
    });

    window.openMetricsModal = (postId) => {
        currentMetricsPostId = postId;
        metricsModal.classList.add('active');
    };
    
    const closeMetricsModal = () => {
        metricsModal.classList.remove('active');
        setTimeout(() => {
            currentMetricsPostId = null;
            metricReactions.value = '';
            metricComments.value = '';
            metricReposts.value = '';
            metricImpressions.value = '';
            metricDate.value = '';
            metricTime.value = '';
        }, 300);
    };
    
    closeMetricsModalBtn.addEventListener('click', closeMetricsModal);
    
    submitMetricsBtn.addEventListener('click', async () => {
        if (!currentMetricsPostId) return;
        
        const originalText = submitMetricsBtn.innerText;
        submitMetricsBtn.innerText = 'Saving...';
        submitMetricsBtn.disabled = true;
        
        const dateVal = metricDate.value;
        const timeVal = metricTime.value;
        const observedAt = (dateVal || timeVal) ? `${dateVal} ${timeVal}`.trim() : null;
        
        const payload = {
            reactions: metricReactions.value,
            comments: metricComments.value,
            reposts: metricReposts.value,
            impressions: metricImpressions.value,
            observed_at: observedAt
        };
        
        try {
            const res = await fetch(`/api/posts/${currentMetricsPostId}/metrics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeMetricsModal();
            } else {
                alert('Failed to save stats.');
            }
        } catch (err) {
            console.error('Error saving metrics:', err);
            alert('Error connecting to backend.');
        } finally {
            submitMetricsBtn.innerText = originalText;
            submitMetricsBtn.disabled = false;
        }
    });

    // Load initial posts
    fetchPosts();

    // File selected handler
    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const fileName = e.target.files[0].name;
            imageBtn.style.color = 'var(--primary)';
            submitPostBtn.disabled = false;
        }
    });

    documentInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const fileName = e.target.files[0].name;
            documentBtn.style.color = 'var(--primary)';
            submitPostBtn.disabled = false;
        }
    });

    // Handle post submission
    submitPostBtn.addEventListener('click', async () => {
        const text = postText.value.trim();
        const hasImage = imageInput.files.length > 0;
        const hasDoc = documentInput.files.length > 0;
        
        if (text || hasImage || hasDoc) {
            // Change button to loading state
            const originalText = submitPostBtn.innerText;
            submitPostBtn.innerText = 'Saving...';
            submitPostBtn.disabled = true;

            try {
                // Prepare form data for both text and file
                const formData = new FormData();
                if (text) formData.append('text', text);
                if (mediaDescription.value.trim()) formData.append('media_description', mediaDescription.value.trim());
                
                const dateVal = postDate.value;
                const timeVal = postTime.value;
                if (dateVal || timeVal) {
                    formData.append('posted_at', `${dateVal} ${timeVal}`.trim());
                }
                
                if (hasImage) formData.append('image', imageInput.files[0]);
                if (hasDoc) formData.append('document', documentInput.files[0]);

                let url = '/api/posts';
                let method = 'POST';
                if (editingPostId) {
                    url = `/api/posts/${editingPostId}`;
                    method = 'PUT';
                }

                // Send to backend
                const response = await fetch(url, {
                    method: method,
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    closeModal();
                    fetchPosts();
                } else {
                    alert('Error saving post.');
                }
            } catch (error) {
                console.error('Error connecting to backend:', error);
                alert('Could not connect to the backend server. Is app.py running?');
            } finally {
                // Restore button state
                submitPostBtn.innerText = originalText;
                submitPostBtn.disabled = false;
            }
        }
    });
});
