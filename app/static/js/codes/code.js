document.addEventListener('DOMContentLoaded', () => {
    // 配置Monaco编辑器
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        const { markRaw } = Vue;
        const app = Vue.createApp({
            data() {
                return {
                    showWelcome: true, // 控制欢迎消息显示
                    userAvatar: '/static/img/user.png', // 用户头像路径
                    aiAvatar: '/static/img/ai.png',     // AI头像路径
                    deepThinking: false,                // 深度思考开关
                    selectedModel: 'gpt-3.5',
                    currentPage: '/code',
                    fileListCollapsed: false,
                    monacoEditorInstance: null,
                    files: [],
                    activeFile: null,
                    fileSearchText: '',
                    // 添加以下新变量
                    renameDialogVisible: false,
                    renameForm: {
                        fileId: '',
                        newFilename: ''
                    },
                    deleteDialogVisible: false,
                    fileToDelete: null,
                    messages: [
                        { type: 'ai', content: '你好！我是Python学习助手。有什么可以帮你的吗？' }
                    ],
                    chatInput: '',
                    chatLoading: false,
                    outputTabs: [
                        { id: 'console', icon: '📟' },

                    ],
                    activeOutputTab: 'console',
                    consoleOutput: '',
                    saveDialogVisible: false,
                    saveForm: {
                        filename: ''
                    },
                    editorCache: new Map(), // 用于缓存编辑器内容
                    editorMetadata: {},// 存储编辑器元数据
                    deepseekApiUrl: 'https://api.deepseek.com/chat/completions', // 预留
                    deepseekApiKey: 'sk-12ecefa1b46f4b67ac446fa4baed7e7f',
                }
            },
            computed: {
                filteredFiles() {
                    if (!this.fileSearchText) {
                        return this.files;
                    }
                    const searchText = this.fileSearchText.toLowerCase();
                    return this.files.filter(file =>
                        file.name.toLowerCase().includes(searchText)
                    );
                }
            },
            methods: {
                navigateTo(path) {
                    window.location.href = path;
                },
                toggleFileList() {
                    this.fileListCollapsed = !this.fileListCollapsed;
                },
                async fetchUserCodes() {
                    console.log('开始获取用户代码列表');
                    try {
                        const response = await axios.get('/api/code/codes');
                        console.log('获取到的原始响应:', response);

                        if (response.data.code === 0) {
                            this.files = response.data.data.map(item => ({
                                id: item.cid,
                                name: item.filename || `code_${item.cid.substring(item.cid.lastIndexOf('_') + 1)}.py`,
                                content: item.code || '# 新建Python文件\n'
                            }));
                            console.log('处理后的文件列表:', this.files);

                            // 如果有文件，选择第一个
                            if (this.files.length > 0) {
                                this.selectFile(this.files[0].id);
                            }
                        } else {
                            console.error('获取代码列表失败:', response.data);
                            this.$message.error(response.data.msg || '获取代码列表失败');
                        }
                    } catch (error) {
                        console.error('获取代码列表失败:', error);
                        this.$message.error('获取代码列表失败');
                    }
                },
                selectFile(fileId, event) {
                    // 如果事件来源于操作按钮区域，则不执行文件选择
                    if (event && event.target.closest('.file-actions')) {
                        return;
                    }

                    // 原有的选择文件逻辑
                    if (this.activeFile === fileId) return;

                    // 保存当前文件内容到缓存，包含行号信息
                    if (this.activeFile) {
                        const model = this.monacoEditorInstance.getModel();
                        const lineCount = model.getLineCount();

                        // 获取每一行的内容和行号
                        let contentWithMetadata = [];
                        for (let i = 1; i <= lineCount; i++) {
                            contentWithMetadata.push({
                                lineNumber: i,
                                content: model.getLineContent(i)
                            });
                        }

                        this.editorMetadata[this.activeFile] = {
                            lineCount: lineCount,
                            lines: contentWithMetadata
                        };

                        this.editorCache.set(this.activeFile, this.monacoEditorInstance.getValue());
                    }

                    // 更新活动文件
                    this.activeFile = fileId;
                    const file = this.files.find(f => f.id === fileId);

                    if (file) {
                        // 检查缓存中是否有内容
                        if (this.editorCache.has(fileId)) {
                            this.monacoEditorInstance.setValue(this.editorCache.get(fileId));
                        } else {
                            // 如果缓存中没有，从文件对象加载内容
                            this.monacoEditorInstance.setValue(file.content || '');
                            // 添加到缓存
                            this.editorCache.set(fileId, file.content || '');

                            // 生成初始元数据
                            const model = this.monacoEditorInstance.getModel();
                            const lineCount = model.getLineCount();

                            let contentWithMetadata = [];
                            for (let i = 1; i <= lineCount; i++) {
                                contentWithMetadata.push({
                                    lineNumber: i,
                                    content: model.getLineContent(i)
                                });
                            }

                            this.editorMetadata[fileId] = {
                                lineCount: lineCount,
                                lines: contentWithMetadata
                            };
                        }

                        // 获取聊天记录
                        this.loadChatHistory(fileId);
                        this.$nextTick(() => {
                            if (window.Prism) {
                                Prism.highlightAll();
                            }
                        });
                    }
                },
                async loadChatHistory(fileId) {
                    try {
                        const response = await axios.get(`/api/code/codes/${fileId}/chat`);
                        if (response.data.code === 0 && response.data.data) {
                            try {
                                const chatHistory = JSON.parse(response.data.data);
                                if (Array.isArray(chatHistory)) {
                                    this.messages = chatHistory;
                                }
                            } catch (e) {
                                console.error('解析聊天记录失败:', e);
                                this.messages = [{ type: 'ai', content: '你好！我是Python学习助手。有什么可以帮你的吗？' }];
                            }
                        } else {
                            this.messages = [{ type: 'ai', content: '你好！我是Python学习助手。有什么可以帮你的吗？' }];
                        }
                    } catch (error) {
                        console.error('加载聊天记录失败:', error);
                        this.messages = [{ type: 'ai', content: '你好！我是Python学习助手。有什么可以帮你的吗？' }];
                    }
                    this.$nextTick(() => {
                        if (window.Prism) {
                            Prism.highlightAll();
                        }
                    });
                },
                createNewFile() {
                    // 设置默认文件名，使用时间戳确保唯一性
                    this.saveForm.filename = `new_file_${Date.now().toString().substr(-6)}.py`;
                    // 清空当前激活文件，这样保存时会创建新文件而不是更新现有文件
                    this.activeFile = null;
                    // 设置编辑器内容为一个新的 Python 文件模板
                    this.monacoEditorInstance.setValue('# 新建 Python 文件\n# 创建时间：' + new Date().toLocaleString() + '\n\n');
                    // 显示保存对话框
                    this.saveDialogVisible = true;

                    // 重置消息区域，添加初始欢迎消息
                    this.messages = [
                        { type: 'ai', content: '你好！我是 Python 学习助手。有什么可以帮到您的吗？' }
                    ];

                    // 编辑器获取焦点，方便用户直接开始编码
                    this.$nextTick(() => {
                        if (this.monacoEditorInstance) {
                            this.monacoEditorInstance.focus();
                        }
                    });
                },
                async saveFile() {
                    try {
                        // 获取编辑器内容及元数据
                        const codeContent = this.monacoEditorInstance.getValue();
                        const model = this.monacoEditorInstance.getModel();
                        const lineCount = model.getLineCount();

                        // 更新元数据
                        let contentWithMetadata = [];
                        for (let i = 1; i <= lineCount; i++) {
                            contentWithMetadata.push({
                                lineNumber: i,
                                content: model.getLineContent(i)
                            });
                        }

                        if (this.activeFile) {
                            this.editorMetadata[this.activeFile] = {
                                lineCount: lineCount,
                                lines: contentWithMetadata
                            };
                        }

                        const chatRecordJSON = JSON.stringify(this.messages);

                        // 将元数据添加到保存内容中
                        const payload = {
                            code: codeContent,
                            chatrecord: chatRecordJSON,
                            metadata: JSON.stringify(this.activeFile ? this.editorMetadata[this.activeFile] : null)
                        };

                        let response;

                        if (this.activeFile && this.files.find(f => f.id === this.activeFile)) {
                            // 更新现有文件
                            const fileToUpdate = this.files.find(f => f.id === this.activeFile);
                            payload.filename = fileToUpdate.name; // 保留原文件名
                            response = await axios.put(`/api/code/codes/${this.activeFile}`, payload);
                        } else {
                            // 创建新文件
                            payload.filename = this.saveForm.filename;
                            response = await axios.post('/api/code/codes', payload);
                        }

                        if (response.data.code === 0) {
                            this.$message.success('保存成功');
                            this.saveDialogVisible = false;

                            // 刷新文件列表
                            await this.fetchUserCodes();
                        } else {
                            this.$message.error(response.data.msg || '保存失败');
                        }
                    } catch (error) {
                        console.error('保存文件失败:', error);
                        this.$message.error('保存文件失败');
                    }
                },
                analyzeComplexity() {
                    // 获取当前代码
                    const currentCode = this.monacoEditorInstance.getValue();
                    // 发送消息请求复杂度分析
                    this.sendMessage("分析一下这个程序的时间和空间复杂度", currentCode);
                },

                codeReview() {
                    // 获取当前代码
                    const currentCode = this.monacoEditorInstance.getValue();
                    // 发送消息请求代码评审
                    this.sendMessage("请评审这段代码", currentCode);
                },
                explainCode() {
                    // 获取当前代码
                    const currentCode = this.monacoEditorInstance.getValue();
                    // 发送消息请求代码逻辑解释
                    this.sendMessage("请详细解释这段代码的逻辑和工作原理", currentCode);
                },
                async sendMessage(userInputParam, codeParam) {
                    // 使用参数或当前输入框内容
                    const userInput = userInputParam || this.chatInput;
                    console.log('发送消息:', userInput);
                    if ((!userInput || !userInput.trim()) && this.chatLoading) return;

                    // 获取当前代码
                    const currentCode = codeParam || this.monacoEditorInstance.getValue() || '# 无代码';

                    // 添加用户消息
                    this.messages.push({
                        id: Date.now(),
                        type: 'user',
                        content: userInput,
                        timestamp: new Date().toISOString()
                    });

                    // 如果是手动输入的消息，清空输入框
                    if (!userInputParam) {
                        this.chatInput = '';
                    }

                    this.chatLoading = true;

                    // 获取当前文件名
                    const activeFileObj = this.activeFile ? this.files.find(f => f.id === this.activeFile) : null;
                    const filename = activeFileObj ? activeFileObj.name : 'untitled.py';

                    // 添加AI消息占位
                    const aiMsg = {
                        id: Date.now() + 1,
                        type: 'ai',
                        content: '',
                        timestamp: new Date().toISOString(),
                        isMarkdown: true,
                    };
                    this.messages.push(aiMsg);

                    try {
                        // 构造 deepseek-v3 请求体，在 system 提示词中包含当前代码
                        const payload = {
                            model: "deepseek-chat",
                            messages: [
                                {
                                    role: "system",
                                    content: `你是一个Python学习助手，请用简洁中文回答。当前文件名是: ${filename}\n\n当前代码是：\n\`\`\`python\n${currentCode}\n\`\`\``
                                },
                                ...this.messages
                                    .filter(m => m.type === 'user' || m.type === 'ai')
                                    .map(m => ({
                                        role: m.type === 'user' ? 'user' : 'assistant',
                                        content: m.content
                                    }))
                            ],
                            stream: true
                        };

                        const response = await fetch(this.deepseekApiUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${this.deepseekApiKey}`
                            },
                            body: JSON.stringify(payload)
                        });

                        if (!response.body) throw new Error('无流式响应');

                        const reader = response.body.getReader();
                        const decoder = new TextDecoder('utf-8');
                        let done = false;
                        let aiContent = '';

                        // 找到最后一个ai消息的索引
                        const aiMsgIndex = this.messages.length - 1;

                        while (!done) {
                            const { value, done: doneReading } = await reader.read();
                            done = doneReading;
                            if (value) {
                                const chunk = decoder.decode(value, { stream: true });
                                chunk.split('\n').forEach(line => {
                                    if (line.startsWith('data:')) {
                                        const dataStr = line.replace('data:', '').trim();
                                        if (!dataStr || dataStr === '[DONE]') return;
                                        try {
                                            const data = JSON.parse(dataStr);
                                            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                                aiContent += data.choices[0].delta.content;
                                                // 强制响应式刷新
                                                this.messages[aiMsgIndex].content = aiContent;
                                            }
                                        } catch (e) { }
                                    }
                                });
                            }
                            this.$nextTick(() => this.scrollToLatestMessage());
                            this.$nextTick(() => {
                                if (window.Prism) {
                                    Prism.highlightAll();
                                }
                            });
                        }
                    } catch (error) {
                        // 强制响应式刷新
                        this.messages[this.messages.length - 1].content = '抱歉，大模型接口请求失败。';
                    } finally {
                        this.chatLoading = false;
                        this.$nextTick(() => this.scrollToLatestMessage());
                    }

                },
                renderMarkdown(content) {
                    if (window.marked) {
                        return marked.parse(content || '');
                    }
                    return content;
                },

                // 滚动到最新消息
                scrollToLatestMessage() {
                    const chatContainer = document.querySelector('.epx-ai-chat__messages');
                    if (chatContainer) {
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }
                },
                startHorizontalResize(e) {
                    e.preventDefault();

                    const chatArea = this.$refs.chatArea;
                    const codeArea = this.$refs.codeArea;
                    const mainContent = chatArea.parentElement;
                    const mainContentWidth = mainContent.offsetWidth;
                    const startX = e.clientX;
                    const startWidthPercent = (chatArea.offsetWidth / mainContentWidth) * 100;

                    const doDrag = (e) => {
                        const dx = e.clientX - startX;
                        const newWidthPercent = startWidthPercent + (dx / mainContentWidth) * 100;

                        // 限制最小宽度
                        if (newWidthPercent >= 10 && newWidthPercent <= 90) {
                            chatArea.style.width = `${newWidthPercent}%`;
                            codeArea.style.width = `${100 - newWidthPercent}%`;
                            // 更新编辑器大小
                            if (this.monacoEditorInstance) {
                                this.monacoEditorInstance.layout();
                            }
                        }
                    };

                    const stopDrag = () => {
                        document.removeEventListener('mousemove', doDrag);
                        document.removeEventListener('mouseup', stopDrag);
                    };

                    document.addEventListener('mousemove', doDrag);
                    document.addEventListener('mouseup', stopDrag);
                },
                startVerticalResize(e) {
                    e.preventDefault();

                    const codeEditor = this.$refs.codeEditor;
                    const codeOutput = this.$refs.codeOutput;
                    const codeArea = this.$refs.codeArea;
                    const codeAreaHeight = codeArea.offsetHeight;
                    const startY = e.clientY;
                    const startHeightPercent = (codeEditor.offsetHeight / codeAreaHeight) * 100;

                    const doDrag = (e) => {
                        const dy = e.clientY - startY;
                        const newHeightPercent = startHeightPercent + (dy / codeAreaHeight) * 100;

                        // 限制最小高度
                        if (newHeightPercent >= 10 && newHeightPercent <= 90) {
                            codeEditor.style.height = `${newHeightPercent}%`;
                            codeOutput.style.height = `${100 - newHeightPercent}%`;
                            // 更新编辑器大小
                            if (this.monacoEditorInstance) {
                                this.monacoEditorInstance.layout();
                            }
                        }
                    };

                    const stopDrag = () => {
                        document.removeEventListener('mousemove', doDrag);
                        document.removeEventListener('mouseup', stopDrag);
                    };

                    document.addEventListener('mousemove', doDrag);
                    document.addEventListener('mouseup', stopDrag);
                },
                switchOutputTab(tabId) {
                    this.activeOutputTab = tabId;
                },
                // 获取编辑器特定行的内容
                getLineContent(lineNumber) {
                    if (!this.monacoEditorInstance) return '';
                    const model = this.monacoEditorInstance.getModel();
                    if (lineNumber > model.getLineCount()) return '';
                    return model.getLineContent(lineNumber);
                },
                // 根据行范围获取内容
                getContentByLineRange(startLine, endLine) {
                    if (!this.monacoEditorInstance) return '';
                    const model = this.monacoEditorInstance.getModel();
                    const lineCount = model.getLineCount();

                    startLine = Math.max(1, startLine);
                    endLine = Math.min(lineCount, endLine);

                    let content = '';
                    for (let i = startLine; i <= endLine; i++) {
                        content += model.getLineContent(i) + '\n';
                    }
                    return content;
                },
                // 获取当前选中文本的行范围
                getSelectedLineRange() {
                    if (!this.monacoEditorInstance) return null;
                    const selection = this.monacoEditorInstance.getSelection();
                    if (!selection) return null;

                    return {
                        startLine: selection.startLineNumber,
                        endLine: selection.endLineNumber
                    };
                },
                initMonacoEditor() {
                    // 初始化Monaco编辑器
                    this.monacoEditorInstance = markRaw(monaco.editor.create(
                        this.$refs.codeEditor, {
                        value: '# 开始编写Python代码\n',
                        language: 'python',
                        theme: 'vs',
                        automaticLayout: true,
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        tabSize: 4,
                        insertSpaces: true,
                        wordWrap: 'on'
                    }));


                    // 添加编辑器改变事件，自动保存到缓存
                    this.monacoEditorInstance.onDidChangeModelContent(() => {
                        if (this.activeFile) {
                            // 保存内容到缓存
                            this.editorCache.set(this.activeFile, this.monacoEditorInstance.getValue());

                            // 更新元数据
                            const model = this.monacoEditorInstance.getModel();
                            const lineCount = model.getLineCount();

                            let contentWithMetadata = [];
                            for (let i = 1; i <= lineCount; i++) {
                                contentWithMetadata.push({
                                    lineNumber: i,
                                    content: model.getLineContent(i)
                                });
                            }

                            this.editorMetadata[this.activeFile] = {
                                lineCount: lineCount,
                                lines: contentWithMetadata
                            };
                        }
                    });

                    // 添加选择内容改变事件，更新元数据
                    this.monacoEditorInstance.onDidChangeCursorSelection(() => {
                        if (this.activeFile) {
                            const selection = this.monacoEditorInstance.getSelection();
                            if (selection) {
                                // 更新选中内容元数据
                                if (!this.editorMetadata[this.activeFile]) {
                                    this.editorMetadata[this.activeFile] = {};
                                }

                                this.editorMetadata[this.activeFile].selection = {
                                    startLineNumber: selection.startLineNumber,
                                    startColumn: selection.startColumn,
                                    endLineNumber: selection.endLineNumber,
                                    endColumn: selection.endColumn
                                };
                            }
                        }
                    });

                    // 添加快捷键绑定
                    this.monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                        this.saveFile();
                    });

                    // 运行代码的快捷键
                    this.monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                        // 获取选中代码或整个文件并运行
                        const selection = this.monacoEditorInstance.getSelection();
                        let codeToRun = '';

                        if (selection && !selection.isEmpty()) {
                            // 运行选中的代码
                            const model = this.monacoEditorInstance.getModel();
                            codeToRun = model.getValueInRange(selection);
                        } else {
                            // 运行整个文件
                            codeToRun = this.monacoEditorInstance.getValue();
                        }

                        // 这里可以添加运行代码的逻辑
                        this.runCode(codeToRun);
                    });
                },
                // 运行代码方法
                async runCode(codeParam) {
                    const code = codeParam || (this.monacoEditorInstance ? this.monacoEditorInstance.getValue() : '');
                    if (!code) {
                        this.consoleOutput = "请先输入代码";
                        return;
                    }

                    try {
                        // 在开始时清空之前的输出，显示执行中状态
                        this.consoleOutput = "执行中...";

                        // 获取当前活动文件的信息
                        const activeFileObj = this.activeFile ? this.files.find(f => f.id === this.activeFile) : null;
                        const filename = activeFileObj ? activeFileObj.name : 'untitled.py';

                        // 向后端发送运行代码请求
                        const response = await axios.post('/api/code/run', {
                            code: code,
                            cid: this.activeFile,
                            filename: filename
                        });

                        // 检查响应状态
                        if (response.data.code === 0) {
                            // 正确更新控制台输出
                            const output = response.data.data.output || "执行成功，但没有输出";
                            this.consoleOutput = output;
                            // 自动滚动终端到底部
                            this.$nextTick(() => {
                                const terminalEl = document.querySelector('.console-output pre');
                                if (terminalEl) {
                                    terminalEl.textContent = output;

                                    const scrollEl = document.querySelector('.terminal-style');
                                    if (scrollEl) {
                                        scrollEl.scrollTop = scrollEl.scrollHeight;
                                    }
                                }
                            });
                        } else {
                            // 处理错误情况
                            this.consoleOutput = `运行错误: ${response.data.msg}`;
                        }
                    } catch (error) {
                        console.error('运行代码失败:', error);
                        this.consoleOutput = `错误: ${error.message || '运行失败'}`;
                    }
                },
                // 打开重命名对话框
                renameFile(file) {
                    this.renameForm.fileId = file.id;
                    this.renameForm.newFilename = file.name;
                    this.renameDialogVisible = true;
                },

                // 确认重命名文件
                async confirmRename() {
                    if (!this.renameForm.newFilename.trim()) {
                        this.$message.error('文件名不能为空');
                        return;
                    }

                    try {
                        const fileId = this.renameForm.fileId;
                        const file = this.files.find(f => f.id === fileId);
                        if (!file) {
                            this.$message.error('文件不存在');
                            return;
                        }

                        // 发送请求更新文件名
                        const response = await axios.put(`/api/code/codes/${fileId}`, {
                            filename: this.renameForm.newFilename
                        });

                        if (response.data.code === 0) {
                            // 更新本地文件列表
                            file.name = this.renameForm.newFilename;
                            this.$message.success('文件重命名成功');
                            this.renameDialogVisible = false;
                        } else {
                            this.$message.error(response.data.msg || '重命名失败');
                        }
                    } catch (error) {
                        console.error('重命名文件失败:', error);
                        this.$message.error('重命名文件失败');
                    }
                },

                // 打开删除确认对话框
                confirmDeleteFile(file) {
                    console.log('确认删除文件:', file);
                    // 确保深拷贝对象，避免响应式问题
                    this.fileToDelete = JSON.parse(JSON.stringify(file));
                    // 强制设置对话框可见性
                    this.$nextTick(() => {
                        this.deleteDialogVisible = true;
                        console.log('对话框状态:', this.deleteDialogVisible);
                    });
                },

                // 确认删除文件
                async deleteFile() {
                    console.log('执行删除文件:', this.fileToDelete);
                    if (!this.fileToDelete) {
                        console.error('没有要删除的文件');
                        return;
                    }

                    try {
                        const fileId = this.fileToDelete.id;
                        const response = await axios.delete(`/api/code/codes/${fileId}`);

                        if (response.data.code === 0) {
                            // 从文件列表中移除
                            const index = this.files.findIndex(f => f.id === fileId);
                            if (index !== -1) {
                                this.files.splice(index, 1);
                            }

                            // 如果删除的是当前活动文件，则选择另一个文件
                            if (this.activeFile === fileId) {
                                this.activeFile = null;
                                if (this.files.length > 0) {
                                    this.selectFile(this.files[0].id);
                                } else {
                                    // 如果没有文件了，清空编辑器
                                    if (this.monacoEditorInstance) {
                                        this.monacoEditorInstance.setValue('');
                                    }
                                }
                            }

                            this.$message({
                                message: '文件删除成功',
                                type: 'success'
                            });
                        } else {
                            this.$message.error(response.data.msg || '删除失败');
                        }
                    } catch (error) {
                        console.error('删除文件失败:', error);
                        this.$message.error('删除文件失败: ' + (error.response?.data?.msg || error.message));
                    } finally {
                        this.deleteDialogVisible = false;
                        this.fileToDelete = null;
                    }
                },
                initMonacoEditor() {
                    // 初始化Monaco编辑器
                    this.monacoEditorInstance = markRaw(monaco.editor.create(
                        this.$refs.codeEditor, {
                        value: '# 开始编写Python代码\n',
                        language: 'python',
                        theme: 'vs',
                        automaticLayout: true,
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        tabSize: 4,
                        insertSpaces: true,
                        wordWrap: 'on'
                    }));


                    // 添加编辑器改变事件，自动保存到缓存
                    this.monacoEditorInstance.onDidChangeModelContent(() => {
                        if (this.activeFile) {
                            // 保存内容到缓存
                            this.editorCache.set(this.activeFile, this.monacoEditorInstance.getValue());

                            // 更新元数据
                            const model = this.monacoEditorInstance.getModel();
                            const lineCount = model.getLineCount();

                            let contentWithMetadata = [];
                            for (let i = 1; i <= lineCount; i++) {
                                contentWithMetadata.push({
                                    lineNumber: i,
                                    content: model.getLineContent(i)
                                });
                            }

                            this.editorMetadata[this.activeFile] = {
                                lineCount: lineCount,
                                lines: contentWithMetadata
                            };
                        }
                    });

                    // 添加选择内容改变事件，更新元数据
                    this.monacoEditorInstance.onDidChangeCursorSelection(() => {
                        if (this.activeFile) {
                            const selection = this.monacoEditorInstance.getSelection();
                            if (selection) {
                                // 更新选中内容元数据
                                if (!this.editorMetadata[this.activeFile]) {
                                    this.editorMetadata[this.activeFile] = {};
                                }

                                this.editorMetadata[this.activeFile].selection = {
                                    startLineNumber: selection.startLineNumber,
                                    startColumn: selection.startColumn,
                                    endLineNumber: selection.endLineNumber,
                                    endColumn: selection.endColumn
                                };
                            }
                        }
                    });

                    // 添加快捷键绑定
                    this.monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                        this.saveFile();
                    });

                    // 运行代码的快捷键
                    this.monacoEditorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                        // 获取选中代码或整个文件并运行
                        const selection = this.monacoEditorInstance.getSelection();
                        let codeToRun = '';

                        if (selection && !selection.isEmpty()) {
                            // 运行选中的代码
                            const model = this.monacoEditorInstance.getModel();
                            codeToRun = model.getValueInRange(selection);
                        } else {
                            // 运行整个文件
                            codeToRun = this.monacoEditorInstance.getValue();
                        }

                        // 这里可以添加运行代码的逻辑
                        this.runCode(codeToRun);
                    });
                },
                // 运行代码方法
                async runCode(codeParam) {
                    const code = codeParam || (this.monacoEditorInstance ? this.monacoEditorInstance.getValue() : '');
                    if (!code) {
                        this.consoleOutput = "请先输入代码";
                        return;
                    }

                    try {
                        // 在开始时清空之前的输出，显示执行中状态
                        this.consoleOutput = "执行中...";

                        // 获取当前活动文件的信息
                        const activeFileObj = this.activeFile ? this.files.find(f => f.id === this.activeFile) : null;
                        const filename = activeFileObj ? activeFileObj.name : 'untitled.py';

                        // 向后端发送运行代码请求
                        const response = await axios.post('/api/code/run', {
                            code: code,
                            cid: this.activeFile,
                            filename: filename
                        });

                        // 检查响应状态
                        if (response.data.code === 0) {
                            // 正确更新控制台输出
                            const output = response.data.data.output || "执行成功，但没有输出";
                            this.consoleOutput = output;
                            // 自动滚动终端到底部
                            this.$nextTick(() => {
                                const terminalEl = document.querySelector('.console-output pre');
                                if (terminalEl) {
                                    terminalEl.textContent = output;

                                    const scrollEl = document.querySelector('.terminal-style');
                                    if (scrollEl) {
                                        scrollEl.scrollTop = scrollEl.scrollHeight;
                                    }
                                }
                            });
                        } else {
                            // 处理错误情况
                            this.consoleOutput = `运行错误: ${response.data.msg}`;
                        }
                    } catch (error) {
                        console.error('运行代码失败:', error);
                        this.consoleOutput = `错误: ${error.message || '运行失败'}`;
                    }
                }
            },
            async mounted() {
                // 初始化Monaco编辑器
                this.initMonacoEditor();

                // 设置当前活动页面
                this.currentPage = window.location.pathname;

                // 获取用户代码列表
                await this.fetchUserCodes();

                this.$watch('consoleOutput', (newVal) => {
                    console.log('consoleOutput 更新为:', newVal);
                });

                // 如果没有文件，创建一个空文件
                if (this.files.length === 0) {
                    this.createNewFile();
                }
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
        app.component('el-icon-search', {
            template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M795.904 750.72l124.992 124.928a32 32 0 0 1-45.248 45.248l-124.928-124.992a416 416 0 1 1 45.248-45.248zM480 832a352 352 0 1 0 0-704 352 352 0 0 0 0 704z"></path></svg>`
        });
        app.component('el-icon-arrow-left', {
            template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M609.408 149.376L277.76 489.6a32 32 0 0 0 0 44.672l331.648 340.352a29.12 29.12 0 0 0 41.728 0 30.592 30.592 0 0 0 0-42.752L339.264 511.936l311.872-319.872a30.592 30.592 0 0 0 0-42.688 29.12 29.12 0 0 0-41.728 0z"></path></svg>`
        });
        app.component('el-icon-arrow-right', {
            template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M340.864 149.312a30.592 30.592 0 0 0 0 42.752L652.736 512 340.864 831.872a30.592 30.592 0 0 0 0 42.752 29.12 29.12 0 0 0 41.728 0L714.24 534.336a32 32 0 0 0 0-44.672L382.592 149.376a29.12 29.12 0 0 0-41.728 0z"></path></svg>`
        });

        app.component('el-icon-position', {
            template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M512 512a192 192 0 1 0 0-384 192 192 0 0 0 0 384zm0 64a256 256 0 1 1 0-512 256 256 0 0 1 0 512z"></path><path fill="currentColor" d="M512 512a32 32 0 0 1 32 32v256a32 32 0 1 1-64 0V544a32 32 0 0 1 32-32z"></path><path fill="currentColor" d="M384 649.088v64.96C269.76 732.352 192 771.904 192 800c0 37.696 139.904 96 320 96s320-58.304 320-96c0-28.16-77.76-67.648-192-85.952v-64.96C789.12 671.04 896 730.368 896 800c0 88.32-171.904 160-384 160s-384-71.68-384-160c0-69.632 106.88-128.96 256-150.912z"></path></svg>`
        });

        app.component('more', {
            template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M176 416a112 112 0 1 0 0 224 112 112 0 0 0 0-224zm336 0a112 112 0 1 0 0 224 112 112 0 0 0 0-224zm336 0a112 112 0 1 0 0 224 112 112 0 0 0 0-224z"></path></svg>`
        });

        // 使用Element Plus
        app.use(ElementPlus);

        // 在 app.mount('#app') 前添加
        if (window.ElementPlusX) {
            const { BubbleList, Bubble, MentionSender, Welcome, Typewriter } = window.ElementPlusX;
            console.log("组件是否存在:",
                Boolean(BubbleList),
                Boolean(Bubble),
                Boolean(MentionSender),
                Boolean(Welcome),
                Boolean(Typewriter),
            );
            app.component('BubbleList', BubbleList);
            app.component('Bubble', Bubble);
            app.component('mention-sender', MentionSender);
            app.component('Welcome', Welcome);
            app.component('Typewriter', Typewriter);
        } else {
            console.error("ElementPlusX 未加载或组件不可用");
        }


        if (window.ElementPlusIconsVue) {
            for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
                app.component(key, component);

            }
        } else {
            console.error('ElementPlusIconsVue 未加载，请确认相关库的引入');
        }
        console.log('ElementPlusIconsVue 组件注册完成');
        const vm = app.mount('#app');
        window.vm = vm;
    });
});

