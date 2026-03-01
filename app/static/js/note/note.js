document.addEventListener('DOMContentLoaded', () => {
    const { ref, reactive, computed, nextTick, onMounted, watch } = Vue;
    const { ElNotification, ElMessageBox } = ElementPlus;

    // Vue应用初始化
    const app = Vue.createApp({
        setup() {
            // 当前页面路径
            const currentPage = ref(window.location.pathname);

            // 笔记列表
            const notes = ref([]);

            // 当前选中的笔记
            const currentNote = ref(null);

            // 是否处于预览模式
            const viewMode = ref(false);

            // 保存状态
            const saving = ref(false);

            // 搜索查询
            const searchQuery = ref('');

            // 筛选条件
            const filters = reactive({
                state: '',
                top: '',
                tags: []
            });

            const editormdReady = ref(false);

            // 检查 editormd 是否已加载和初始化完成
            function checkEditorMdReady() {
                return typeof editormd !== 'undefined' &&
                    typeof editormd.markdownToHTML === 'function' &&
                    typeof editormd.markedRenderer === 'function';
            }

            onMounted(() => {
                fetchNotes();

                // 定期检查 editormd 是否已完全加载
                const checkInterval = setInterval(() => {
                    if (checkEditorMdReady()) {
                        editormdReady.value = true;
                        clearInterval(checkInterval);
                        console.log('Editor.md 已完全加载');
                    }
                }, 100);

                // 设置超时，避免无限等待
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (!editormdReady.value) {
                        console.warn('Editor.md 加载超时');
                    }
                }, 5000);
            });

            // 标签输入
            const inputTagVisible = ref(false);
            const inputTagValue = ref('');
            const tagInputRef = ref(null);

            // Editor.md 实例
            const editor = ref(null);

            // 渲染后的Markdown内容
            const renderedContent = ref('');

            // 内容是否被修改
            const isDirty = ref(false);

            // 计算所有标签
            const allTags = computed(() => {
                const tagSet = new Set();
                notes.value.forEach(note => {
                    if (note.tag && Array.isArray(note.tag)) {
                        note.tag.forEach(tag => tagSet.add(tag));
                    }
                });
                return Array.from(tagSet);
            });

            // 过滤后的笔记列表（保留现有实现）
            const filteredNotes = computed(() => {
                return notes.value.filter(note => {
                    // 标题或摘要搜索
                    const searchMatches = !searchQuery.value ||
                        (note.title && note.title.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
                        (note.abstract && note.abstract.toLowerCase().includes(searchQuery.value.toLowerCase()));
            
                    // 状态筛选 - 修复：明确检查是否为空字符串
                    const stateMatches = filters.state === '' || !filters.state || note.state === filters.state;
            
                    // 置顶筛选 - 修复：明确检查是否为空字符串或undefined
                    const topMatches = filters.top === '' || filters.top === undefined || note.top === filters.top;
            
                    // 标签筛选 - 修复：确保在笔记没有标签时也能正确处理
                    const tagMatches = !filters.tags || filters.tags.length === 0 ||
                        (note.tag && Array.isArray(note.tag) && filters.tags.every(tag => note.tag.includes(tag)));
            
                    return searchMatches && stateMatches && topMatches && tagMatches;
                }).sort((a, b) => {
                    // 先按置顶排序
                    if (a.top !== b.top) {
                        return b.top - a.top;
                    }
                    // 再按收藏数排序
                    if (a.collection !== b.collection) {
                        return b.collection - a.collection;
                    }
                    // 最后按更新时间排序
                    return new Date(b.update) - new Date(a.update);
                });
            });

            // 导航到指定路径
            function navigateTo(path) {
                window.location.href = path;
            }

            // 获取笔记列表
            async function fetchNotes() {
                try {
                    // 从localStorage或其他存储中获取用户ID
                    const uid = localStorage.getItem('uid') || 'test-user';
                    const response = await axios.get(`/api/note/list?uid=${uid}`);
                    if (response.data.code === 0) {
                        notes.value = response.data.data;
                    } else {
                        ElNotification({
                            title: '错误',
                            message: response.data.msg || '获取笔记列表失败',
                            type: 'error'
                        });
                    }
                } catch (error) {
                    console.error('获取笔记列表出错:', error);
                    ElNotification({
                        title: '错误',
                        message: '网络错误，获取笔记列表失败',
                        type: 'error'
                    });
                }
            }

            // 初始化编辑器
            function initEditor() {
                if (editor.value) {
                    // 如果编辑器已存在，先销毁
                    editor.value.editor.remove();
                }

                nextTick(() => {
                    // 确保DOM已更新
                    editor.value = editormd("editormd", {
                        width: "100%",
                        height: "100%",
                        path: "../static/editormd/lib/",
                        theme: "default",
                        previewTheme: "default",
                        editorTheme: "default",
                        markdown: currentNote.value?.content || '',
                        codeFold: true,
                        saveHTMLToTextarea: true,
                        searchReplace: true,
                        watch: true,
                        htmlDecode: "style,script,iframe",
                        emoji: true,
                        taskList: true,
                        tocm: true,
                        tex: true,
                        flowChart: true,
                        sequenceDiagram: true,
                        placeholder: "请输入Markdown内容...",
                        onchange: function () {
                            // 更新内容
                            currentNote.value.content = this.getMarkdown();
                            isDirty.value = true;
                        }
                    });

                    // 如果是只读模式，禁用编辑器
                    if (viewMode.value && currentNote.value && currentNote.value.state === 'completed') {
                        editor.value.setDisabled();
                    }
                });
            }

            // 渲染Markdown（用于预览模式）
            function renderMarkdown() {
                if (!currentNote.value || !currentNote.value.content) {
                    renderedContent.value = '';
                    return;
                }
                try {
                    const md = window.markdownit({
                        html: true,
                        linkify: true,
                        typographer: true,
                        breaks: true
                    }).use(window.texmath.use(window.katex), {delimiters: 'dollars'});
                    renderedContent.value = md.render(currentNote.value.content);
                } catch (error) {
                    console.error('Markdown-it 渲染错误:', error);
                    renderedContent.value = '<pre>' + currentNote.value.content + '</pre>';
                }
                nextTick(() => {
                    if (window.Prism) {
                        Prism.highlightAll();
                    }
                });
            }

            // 选择笔记
            function selectNote(note) {
                // 如果当前有未保存的笔记，提示保存
                if (currentNote.value && isDirty.value) {
                    ElMessageBox.confirm('当前笔记有未保存的内容，是否保存？', '提示', {
                        confirmButtonText: '保存',
                        cancelButtonText: '不保存',
                        type: 'warning'
                    }).then(() => {
                        // 保存当前笔记
                        saveNote().then(() => {
                            loadNote(note);
                        });
                    }).catch(() => {
                        // 不保存，直接加载新笔记
                        isDirty.value = false;
                        loadNote(note);
                    });
                } else {
                    // 直接加载新笔记
                    loadNote(note);
                }
            }

            // 加载笔记详情
            async function loadNote(note) {
                try {
                    // 从localStorage或其他存储中获取用户ID
                    const uid = localStorage.getItem('uid') || 'test-user';
                    const response = await axios.get(`/api/note/detail/${note.nid}?uid=${uid}`);
            
                    if (response.data.code === 0) {
                        currentNote.value = response.data.data;
            
                        // 设置视图模式
                        viewMode.value = currentNote.value.state === 'completed';
            
                        if (viewMode.value) {
                            // 预览模式 - 确保 editormd 已加载
                            if (!editormdReady.value) {
                                // 如果 editormd 尚未加载完成，显示加载指示器并等待
                                renderedContent.value = '<div class="loading-indicator">加载中...</div>';
                                
                                // 等待 editormd 加载完成或超时
                                await new Promise((resolve) => {
                                    const checkInterval = setInterval(() => {
                                        if (editormdReady.value) {
                                            clearInterval(checkInterval);
                                            clearTimeout(timeoutId);
                                            resolve();
                                        }
                                    }, 100);
                                    
                                    const timeoutId = setTimeout(() => {
                                        clearInterval(checkInterval);
                                        resolve();  // 即使超时也继续执行，会使用降级渲染
                                    }, 3000);
                                });
                            }
                            
                            // 现在可以安全渲染了
                            renderMarkdown();
                            nextTick(() => {
                                if (window.Prism) {
                                    Prism.highlightAll();
                                }
                            });
                        } else {
                            // 编辑模式
                            nextTick(() => {
                                initEditor();
                                
                            });
                        }
            
                        isDirty.value = false;
                    } else {
                        ElNotification({
                            title: '错误',
                            message: response.data.msg || '获取笔记详情失败',
                            type: 'error'
                        });
                    }
                } catch (error) {
                    console.error('获取笔记详情出错:', error);
                    ElNotification({
                        title: '错误',
                        message: '网络错误，获取笔记详情失败',
                        type: 'error'
                    });
                }
            }

            // 创建新笔记
            async function createNote() {
                try {
                    const uid = localStorage.getItem('uid') || 'test-user';
                    const response = await axios.post('/api/note/create', {
                        uid: uid,
                        title: '新笔记',
                        abstract: '',
                        content: '',
                        state: 'editing',
                        top: 0,
                        collection: 0,
                        tag: []
                    });

                    if (response.data.code === 0) {
                        ElNotification({
                            title: '成功',
                            message: '创建笔记成功',
                            type: 'success'
                        });

                        // 重新获取笔记列表
                        await fetchNotes();

                        // 选择新创建的笔记
                        const newNote = notes.value.find(n => n.nid === response.data.data.nid);
                        if (newNote) {
                            selectNote(newNote);
                        }
                    } else {
                        ElNotification({
                            title: '错误',
                            message: response.data.msg || '创建笔记失败',
                            type: 'error'
                        });
                    }
                } catch (error) {
                    console.error('创建笔记出错:', error);
                    ElNotification({
                        title: '错误',
                        message: '网络错误，创建笔记失败',
                        type: 'error'
                    });
                }
            }

            // 保存笔记
            async function saveNote() {
                if (!currentNote.value) return;

                saving.value = true;

                try {
                    // 如果是编辑模式，从编辑器获取最新内容
                    if (!viewMode.value && editor.value) {
                        currentNote.value.content = editor.value.getMarkdown();
                    }

                    const uid = localStorage.getItem('uid') || 'test-user';
                    const response = await axios.post('/api/note/update', {
                        uid: uid,
                        nid: currentNote.value.nid,
                        title: currentNote.value.title,
                        abstract: currentNote.value.abstract,
                        content: currentNote.value.content,
                        state: currentNote.value.state,
                        top: currentNote.value.top,
                        collection: currentNote.value.collection,
                        tag: currentNote.value.tag
                    });

                    if (response.data.code === 0) {
                        ElNotification({
                            title: '成功',
                            message: '保存笔记成功',
                            type: 'success'
                        });

                        // 更新本地笔记数据
                        const index = notes.value.findIndex(n => n.nid === currentNote.value.nid);
                        if (index !== -1) {
                            notes.value[index] = { ...notes.value[index], ...currentNote.value };
                        }

                        // 如果状态变为已完成，则切换到预览模式
                        if (currentNote.value.state === 'completed' && !viewMode.value) {
                            viewMode.value = true;
                            renderMarkdown();
                        }

                        isDirty.value = false;
                    } else {
                        ElNotification({
                            title: '错误',
                            message: response.data.msg || '保存笔记失败',
                            type: 'error'
                        });
                    }
                } catch (error) {
                    console.error('保存笔记出错:', error);
                    ElNotification({
                        title: '错误',
                        message: '网络错误，保存笔记失败',
                        type: 'error'
                    });
                } finally {
                    saving.value = false;
                }
            }

            // 删除笔记确认
            function deleteNoteConfirm() {
                if (!currentNote.value) return;

                ElMessageBox.confirm('确认删除该笔记吗？此操作不可逆', '警告', {
                    confirmButtonText: '确认',
                    cancelButtonText: '取消',
                    type: 'warning'
                }).then(() => {
                    deleteNote();
                }).catch(() => { });
            }

            // 删除笔记
            async function deleteNote() {
                if (!currentNote.value) return;

                try {
                    const uid = localStorage.getItem('uid') || 'test-user';
                    const response = await axios.delete(`/api/note/delete/${currentNote.value.nid}?uid=${uid}`);

                    if (response.data.code === 0) {
                        ElNotification({
                            title: '成功',
                            message: '删除笔记成功',
                            type: 'success'
                        });

                        // 更新笔记列表
                        const index = notes.value.findIndex(n => n.nid === currentNote.value.nid);
                        if (index !== -1) {
                            notes.value.splice(index, 1);
                        }

                        // 清空当前笔记
                        currentNote.value = null;
                    } else {
                        ElNotification({
                            title: '错误',
                            message: response.data.msg || '删除笔记失败',
                            type: 'error'
                        });
                    }
                } catch (error) {
                    console.error('删除笔记出错:', error);
                    ElNotification({
                        title: '错误',
                        message: '网络错误，删除笔记失败',
                        type: 'error'
                    });
                }
            }

            // 显示标签输入框
            function showTagInput() {
                inputTagVisible.value = true;
                nextTick(() => {
                    tagInputRef.value.focus();
                });
            }

            // 确认添加标签
            function confirmTag() {
                if (inputTagValue.value) {
                    if (!currentNote.value.tag) {
                        currentNote.value.tag = [];
                    }
                    if (!currentNote.value.tag.includes(inputTagValue.value)) {
                        currentNote.value.tag.push(inputTagValue.value);
                        isDirty.value = true;
                    }
                }
                inputTagVisible.value = false;
                inputTagValue.value = '';
            }

            // 移除标签
            function removeTag(tag) {
                if (!currentNote.value || !currentNote.value.tag) return;

                const index = currentNote.value.tag.indexOf(tag);
                if (index !== -1) {
                    currentNote.value.tag.splice(index, 1);
                    isDirty.value = true;
                }
            }

            // 格式化日期
            function formatDate(dateStr) {
                if (!dateStr) return '';

                const date = new Date(dateStr);
                const now = new Date();
                const diffMs = now - date;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                    return '今天';
                } else if (diffDays === 1) {
                    return '昨天';
                } else if (diffDays < 7) {
                    return `${diffDays}天前`;
                } else {
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                }
            }

            // 处理Markdown文件导入
            function beforeMdUpload(file) {
                const isMd = file.type === 'text/markdown' || file.name.endsWith('.md');
                if (!isMd) {
                    ElNotification({
                        title: '错误',
                        message: '只能上传Markdown文件!',
                        type: 'error'
                    });
                }
                return isMd;
            }

            // 导入成功回调
            function handleImportSuccess(response) {
                if (response.code === 0) {
                    ElNotification({
                        title: '成功',
                        message: '导入Markdown成功',
                        type: 'success'
                    });

                    // 刷新笔记列表
                    fetchNotes().then(() => {
                        // 选择新导入的笔记
                        const importedNote = notes.value.find(n => n.nid === response.data.nid);
                        if (importedNote) {
                            selectNote(importedNote);
                        }
                    });
                } else {
                    ElNotification({
                        title: '错误',
                        message: response.msg || '导入Markdown失败',
                        type: 'error'
                    });
                }
            }

            // 监视视图模式的变化
            watch(viewMode, (newVal) => {
                if (currentNote.value) {
                    if (newVal) {
                        // 切换到预览模式
                        renderMarkdown();
                    } else {
                        // 切换到编辑模式
                        nextTick(() => {
                            initEditor();
                        });
                    }
                }
            });

            // 初始化
            onMounted(() => {
                fetchNotes();
            });

            // 返回setup函数的数据和方法
            return {
                // 数据
                currentPage,
                notes,
                currentNote,
                viewMode,
                saving,
                searchQuery,
                filters,
                allTags,
                inputTagVisible,
                inputTagValue,
                tagInputRef,
                renderedContent,
                filteredNotes,
                isDirty,

                // 方法
                navigateTo,
                selectNote,
                createNote,
                saveNote,
                deleteNoteConfirm,
                renderMarkdown,
                showTagInput,
                confirmTag,
                removeTag,
                formatDate,
                beforeMdUpload,
                handleImportSuccess,

                // Element Plus图标
                Plus: Vue.markRaw(ElementPlusIconsVue.Plus),
                Search: Vue.markRaw(ElementPlusIconsVue.Search),
                Edit: Vue.markRaw(ElementPlusIconsVue.Edit),
                View: Vue.markRaw(ElementPlusIconsVue.View),
                Delete: Vue.markRaw(ElementPlusIconsVue.Delete),
                Document: Vue.markRaw(ElementPlusIconsVue.Document),
                Star: Vue.markRaw(ElementPlusIconsVue.Star)
            };
        }
    });


    // 注册Element Plus图标组件
    app.component('el-icon-house', {
        template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M192 413.952V896h640V413.952L512 147.328 192 413.952zM139.52 374.4l352-293.312a32 32 0 0 1 40.96 0l352 293.312A32 32 0 0 1 896 398.976V928a32 32 0 0 1-32 32H160a32 32 0 0 1-32-32V398.976a32 32 0 0 1 11.52-24.576z"></path></svg>`
    });
    app.component('el-icon-reading', {
        template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M512 863.36l384-54.848v-638.72l-384 54.848zM512 91.52L128 146.368v638.72l384-54.848zM512 41.728a32 32 0 0 1 31.552 27.52L544 96v800a32 32 0 0 1-32 32 32 32 0 0 1-31.552-27.52L480 864V96a32 32 0 0 1 32-54.272z"></path></svg>`
    });
    app.component('el-icon-notebook', {
        template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M192 128v768h640V128H192zm-32-64h704a32 32 0 0 1 32 32v832a32 32 0 0 1-32 32H160a32 32 0 0 1-32-32V96a32 32 0 0 1 32-32z"></path><path fill="currentColor" d="M672 128h64v768h-64zM96 192h128q32 0 32 32t-32 32H96q-32 0-32-32t32-32zm0 192h128q32 0 32 32t-32 32H96q-32 0-32-32t32-32zm0 192h128q32 0 32 32t-32 32H96q-32 0-32-32t32-32zm0 192h128q32 0 32 32t-32 32H96q-32 0-32-32t32-32z"></path></svg>`
    });
    app.component('el-icon-terminal', {
        template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M310.293 77.329l471.701 179.2c52.352 19.883 77.76 83.2 57.877 135.424-7.68 20.053-22.528 36.352-41.472 44.8L333.568 608.694c-52.224 19.883-111.488-5.76-131.371-57.856a108.8 108.8 0 0 1-1.152-59.2l85.632 32.512 158.72-71.68-170.88-64.896-72.96 27.648-87.04-33.024c12.288-45.44 52.48-76.8 99.2-91.2zM959.552 895.488H64.448a64.448 64.448 0 0 0 0 128.896h895.104a64.448 64.448 0 0 0 0-128.896zM0 895.488z"></path></svg>`
    });
    app.component('el-icon-user', {
        template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M512 512a192 192 0 1 0 0-384 192 192 0 0 0 0 384zm0 64a256 256 0 1 1 0-512 256 256 0 0 1 0 512zm320 320v-96a96 96 0 0 0-96-96H288a96 96 0 0 0-96 96v96a32 32 0 1 1-64 0v-96a160 160 0 0 1 160-160h448a160 160 0 0 1 160 160v96a32 32 0 1 1-64 0z"></path></svg>`
    });

    // 注册Element Plus所有图标
    for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
        app.component(key, component);
    }

    app.use(ElementPlus);
    app.mount('#app');


});