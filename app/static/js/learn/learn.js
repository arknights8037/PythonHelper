document.addEventListener('DOMContentLoaded', () => {
    // 菜单数据（保持不变）
    const menuData = [
        {
            label: 'Python程序设计入门',
            value: 'basic',
            children: [
                {
                    label: '基本语法',
                    value: '基本语法',
                    children: [
                        { label: '注释', value: '注释' },
                        { label: '变量与数据类型', value: '变量与数据类型' },
                        { label: '运算符', value: '运算符' }
                    ]
                },
                {
                    label: '控制结构',
                    value: '控制结构',
                    children: [
                        { label: '选择结构', value: '选择结构' },
                        { label: '循环结构', value: '循环结构' }
                    ]
                },
                {
                    label: '数据结构',
                    value: '数据结构',
                    children: [
                        { label: '列表(List)', value: '列表(List)' },
                        { label: '元组(Tumple)', value: '元组(Tumple)' },
                        { label: '字典(Dictionary)', value: '字典(Dictionary)' },
                        { label: '集合(Set)', value: '集合(Set)' }
                    ]
                },
                {
                    label: '函数与模块',
                    value: '函数与模块',
                    children: [
                        { label: '函数定义与调用', value: '函数定义与调用' },
                        { label: '参数与返回值', value: '参数与返回值' },
                        { label: '递归函数', value: '递归函数' },
                        { label: '匿名函数(Lambda)', value: '匿名函数(Lambda)' },
                        { label: '模块与包的使用', value: '模块与包的使用' }
                    ]
                },
                {
                    label: '文件操作',
                    value: '文件操作',
                    children: [
                        { label: '文件的读写操作', value: '文件的读写操作' },
                        { label: '文件路径与操作', value: '文件路径与操作' }
                    ]
                },
                {
                    label: '异常处理',
                    value: '异常处理',
                    children: [
                        { label: '基本异常类型', value: '基本异常类型' },
                        { label: 'try-except语句', value: 'try-except语句' },
                        { label: '自定义异常', value: '自定义异常' }
                    ]
                }
            ]
        },
        {
            label: '数据结构入门',
            value: 'datastructurebasic',
            children: [
                {
                    label: '链表',
                    value: '链表',
                    children: [
                        { label: '单链表', value: '单链表' },
                        { label: '双链表', value: '双链表' }
                    ]
                }
            ]
        }
    ];

    const app = Vue.createApp({
        data() {
            return {
                currentPage: window.location.pathname,
                menuData,
                menuStack: [{ label: '全部', value: 'root', children: menuData }],
                selectedTags: [],
                activeTab: 'learn',
                userAvatar: '/static/img/user.jpg',
                aiAvatar: '/static/img/ai.jpg',
                isQaDisabled: false, // 控制问答按钮禁用状态
                sessionId: null, // 用于存储会话ID
                messages: [],
                currentAIResponse: '', // 用于累积AI响应
                astUpdateTime: 0,
                updateInterval: 300,
                contentBuffer: 0,
                activeStep: 0,
                promptStatus: 'wait',
                learningStatus: 'wait',
                qaStatus: 'wait',
                chatInput: '',
                chatLoading: false,
                autoGenerateNote: false,
                clearContextAfterSave: false,
                eventSource: null, // 替换socket，使用eventSource
                typingSpeed: 20, // 打字速度(ms)
                typingInProgress: false, // 正在执行打字效果
                currentTypingMessage: null, // 当前正在执行打字效果的消息
                typingQueue: [], // 打字队列
                learningPrompt: '', // 存储学习提示词
                learningContent: [], // 存储学习内容的消息
                qaContent: [], // 存储问答内容的消息
                activeContentType: 'learning', // 当前显示的内容类型：'learning' 或 'qa'
            }
        },
        computed: {
            // 原有计算属性保持不变
            currentMenu() {
                if (!this.menuStack.length || !this.menuStack[this.menuStack.length - 1]) return [];
                return this.menuStack[this.menuStack.length - 1].children || [];
            },
            isRoot() {
                return this.menuStack.length === 1;
            },
            messages() {
                return this.activeContentType === 'learning' ? this.learningContent : this.qaContent;
            }
        },
        methods: {
            adjustTextareaHeight(e) {
                const textarea = e.target;
                textarea.style.height = 'auto';
                const newHeight = Math.min(textarea.scrollHeight, 120);
                textarea.style.height = newHeight + 'px';
            },
            // 切换显示学习内容或问答内容
            switchContentType(type) {
                this.activeContentType = type;
                this.scrollToBottom();
            },

            // 新增的Markdown渲染方法
            renderMarkdown(content) {
                if (!content) return '';
                try {
                    // 使用marked库进行Markdown渲染
                    return marked.parse(content);
                } catch (e) {
                    console.error('Markdown渲染错误:', e);
                    return content;
                }
            },

            // 滚动到底部方法
            scrollToBottom() {
                this.$nextTick(() => {
                    const container = this.$refs.messageContainer;
                    if (container) {
                        container.scrollTop = container.scrollHeight;
                    }
                });
            },

            // 高亮代码块
            highlightCode() {
                this.$nextTick(() => {
                    if (window.Prism) {
                        Prism.highlightAll();
                    }
                });
            },

            // 原有方法保持不变
            handleMenuClick(item) {
                // 一级菜单：跳转到二级
                if (this.menuStack.length === 1 && item.children) {
                    this.menuStack.push(item);
                }
                // 二级菜单：可展开三级，三级可多选
                else if (this.menuStack.length === 2) {
                    if (item.children) {
                        // 二级菜单有 children，el-sub-menu 自动展开
                    } else {
                        // 三级菜单多选
                        const idx = this.selectedTags.indexOf(item.value);
                        if (idx === -1) {
                            this.selectedTags.push(item.value);
                        } else {
                            this.selectedTags.splice(idx, 1);
                        }
                    }
                }
            },
            handleBack() {
                if (this.menuStack.length > 1) {
                    this.menuStack.pop();
                    this.selectedTags = [];
                }
            },
            removeTag(tag) {
                const idx = this.selectedTags.indexOf(tag);
                if (idx !== -1) {
                    this.selectedTags.splice(idx, 1);
                }
            },
            handleTabChange(tab) {
                this.activeTab = tab;
                // 在切换标签时，切换显示内容类型
                this.activeContentType = tab === 'learn' ? 'learning' : 'qa';
                if (tab === 'qa') {
                    this.chatLoading = false;
                }

                this.scrollToBottom();
            },
            navigateTo(path) {
                window.location.href = path;
            },

            // 改进的startLearning方法，从后端获取并保存提示词
            async startLearning() {
                if (!this.selectedTags.length) {
                    this.$message.error('请选择知识点后再开始学习！');
                    return;
                }

                this.isQaDisabled = true; // 禁用问答按钮
                setTimeout(() => {
                    this.isQaDisabled = false; // 60秒后恢复
                }, 60000);

                // 清空学习内容
                this.learningContent = [];

                // 添加用户消息到学习内容
                this.learningContent.push({
                    id: Date.now(),
                    type: 'user',
                    content: '开始学习：' + this.selectedTags.join(', '),
                });

                // 切换到学习内容显示
                this.activeContentType = 'learning';
                this.activeTab = 'learn';

                // 滚动到底部
                this.scrollToBottom();

                try {
                    // 关闭之前的EventSource连接(如果存在)
                    if (this.eventSource) {
                        this.eventSource.close();
                        this.eventSource = null;
                    }

                    // 初始化学习会话
                    const response = await fetch('/api/learn/init-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tags: this.selectedTags }),
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    this.sessionId = data.sessionId; // 保存会话ID

                    // 初始化AI消息
                    const aiMessageId = Date.now();
                    this.learningContent.push({
                        id: aiMessageId,
                        type: 'ai',
                        content: '',
                        fullContent: '',
                        isComplete: false
                    });
                    this.scrollToBottom();

                    // 创建EventSource连接
                    this.eventSource = new EventSource(`/api/learn/stream-learn?session=${this.sessionId}`);

                    // 监听消息
                    this.eventSource.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);

                            if (data.type === 'prompt' && data.content) {
                                // 保存提示词到前端
                                this.learningPrompt = data.content;
                                console.log('收到学习提示词:', this.learningPrompt);
                            } else if (data.type === 'content' && data.content) {
                                // 更新当前AI消息内容
                                const aiMsgIndex = this.learningContent.findIndex(msg => msg.id === aiMessageId);
                                if (aiMsgIndex !== -1) {
                                    this.learningContent[aiMsgIndex].fullContent += data.content;
                                    this.learningContent[aiMsgIndex].content = this.learningContent[aiMsgIndex].fullContent;
                                    this.scrollToBottom();
                                    this.highlightCode();
                                }
                            } else if (data.type === 'end') {
                                // 流结束，标记消息完成
                                const aiMsgIndex = this.learningContent.findIndex(msg => msg.id === aiMessageId);
                                if (aiMsgIndex !== -1) {
                                    this.learningContent[aiMsgIndex].isComplete = true;
                                    this.learningContent[aiMsgIndex].content = this.learningContent[aiMsgIndex].fullContent;
                                }

                                this.eventSource.close();
                                this.eventSource = null;
                                this.scrollToBottom();
                                this.highlightCode();
                            }
                        } catch (e) {
                            console.error('处理SSE消息时出错:', e);
                        }
                    };

                    // 处理错误
                    this.eventSource.onerror = (error) => {
                        console.error('SSE连接错误:', error);
                        this.$message.error('与服务器的连接异常断开，请重试');
                        if (this.eventSource) {
                            this.eventSource.close();
                            this.eventSource = null;
                        }
                    };

                } catch (error) {
                    console.error('发送学习请求失败:', error);
                    this.$message.error('发送请求失败，请稍后重试');
                    if (this.eventSource) {
                        this.eventSource.close();
                        this.eventSource = null;
                    }
                }
            },

            // 简化的startQA方法
            async startQA() {
                if (!this.sessionId) {
                    this.$message.error('请先开始学习生成内容，再进行问答');
                    return;
                }

                // 切换到问答标签
                this.activeTab = 'qa';
                this.activeContentType = 'qa';

                // 关闭现有连接
                if (this.eventSource) {
                    this.eventSource.close();
                    this.eventSource = null;
                }

                this.chatLoading = true;
                this.qaStatus = 'process';

                // 清空之前的问答内容（可选）
                // this.qaContent = [];

                // 生成唯一ID
                const aiMsgId = Date.now();

                try {
                    // 初始化AI消息
                    this.qaContent.push({
                        id: aiMsgId,
                        type: 'ai',
                        content: '',
                        fullContent: '',
                        isComplete: false
                    });
                    this.scrollToBottom();

                    // 创建EventSource连接 - 使用前端保存的提示词
                    this.eventSource = new EventSource(`/api/learn/stream-qa?session=${this.sessionId}&question=开始问答`);

                    // 监听消息
                    this.eventSource.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);

                            if (data.type === 'content' && data.content) {
                                // 更新AI消息内容
                                const aiMsgIndex = this.qaContent.findIndex(msg => msg.id === aiMsgId);
                                if (aiMsgIndex !== -1) {
                                    this.qaContent[aiMsgIndex].fullContent += data.content;
                                    this.qaContent[aiMsgIndex].content = this.qaContent[aiMsgIndex].fullContent;
                                    this.scrollToBottom();
                                    this.highlightCode();
                                }
                            } else if (data.type === 'end') {
                                // 流结束，标记消息完成
                                const aiMsgIndex = this.qaContent.findIndex(msg => msg.id === aiMsgId);
                                if (aiMsgIndex !== -1) {
                                    this.qaContent[aiMsgIndex].isComplete = true;
                                    this.qaContent[aiMsgIndex].content = this.qaContent[aiMsgIndex].fullContent;
                                    this.qaStatus = 'success';
                                }

                                this.eventSource.close();
                                this.eventSource = null;
                                this.chatLoading = false;
                                this.scrollToBottom();
                                this.highlightCode();
                            } else if (data.type === 'error') {
                                console.error('QA响应错误:', data.content);
                                this.$message.error(`QA响应错误: ${data.content}`);
                                this.qaStatus = 'error';
                                this.eventSource.close();
                                this.eventSource = null;
                                this.chatLoading = false;
                            }
                        } catch (e) {
                            console.error('处理QA SSE消息时出错:', e);
                        }
                    };

                    // 处理错误
                    this.eventSource.onerror = (error) => {
                        console.error('QA SSE连接错误:', error);
                        this.$message.error('与服务器的连接异常断开，请重试');
                        this.qaStatus = 'error';
                        if (this.eventSource) {
                            this.eventSource.close();
                            this.eventSource = null;
                        }
                        this.chatLoading = false;
                    };
                } catch (error) {
                    console.error('发送QA请求失败:', error);
                    this.$message.error('发送请求失败，请稍后重试');
                    this.qaStatus = 'error';
                    this.chatLoading = false;
                }

                // 设置超时释放loading状态
                setTimeout(() => {
                    if (this.chatLoading) {
                        this.chatLoading = false;
                    }
                }, 30000);
            },

            // 简化的sendQuestion方法
            async sendQuestion() {
                if (!this.sessionId) {
                    this.$message.error('会话未初始化，请先开始学习');
                    return;
                }

                if (!this.chatInput.trim() || this.chatLoading) {
                    return;
                }

                // 关闭之前的连接
                if (this.eventSource) {
                    this.eventSource.close();
                    this.eventSource = null;
                }

                const userMessage = this.chatInput.trim();
                this.chatInput = '';
                this.chatLoading = true;

                // 根据当前活动内容类型选择相应的内容数组
                const currentContent = this.activeContentType === 'learning' ? this.learningContent : this.qaContent;

                // 添加用户消息
                const userMsgId = Date.now();
                currentContent.push({
                    id: userMsgId,
                    type: 'user',
                    content: userMessage
                });
                this.scrollToBottom();

                // 添加AI消息占位
                const aiMsgId = Date.now() + 1;
                currentContent.push({
                    id: aiMsgId,
                    type: 'ai',
                    content: '',
                    fullContent: '',
                    isComplete: false
                });
                this.scrollToBottom();

                try {
                    // 根据当前活动内容类型选择不同的API
                    let apiUrl, requestData;

                    if (this.activeContentType === 'learning') {
                        // 学习聊天使用stream-chat接口
                        apiUrl = '/api/learn/stream-chat';
                        requestData = {
                            sessionId: this.sessionId,
                            question: userMessage,
                            history: this.getLearningHistory(),
                            prompt: this.learningPrompt  // 使用前端保存的提示词
                        };

                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestData)
                        });

                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        let buffer = '';

                        // 处理流式响应
                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n\n');
                            buffer = lines.pop() || '';

                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const jsonData = JSON.parse(line.substring(6));

                                        if (jsonData.type === 'content' && jsonData.content) {
                                            // 更新AI消息内容
                                            const aiMsgIndex = this.learningContent.findIndex(msg => msg.id === aiMsgId);
                                            if (aiMsgIndex !== -1) {
                                                this.learningContent[aiMsgIndex].fullContent += jsonData.content;
                                                this.learningContent[aiMsgIndex].content = this.learningContent[aiMsgIndex].fullContent;
                                                this.scrollToBottom();
                                                this.highlightCode();
                                            }
                                        } else if (jsonData.type === 'end') {
                                            // 流结束
                                            const aiMsgIndex = this.learningContent.findIndex(msg => msg.id === aiMsgId);
                                            if (aiMsgIndex !== -1) {
                                                this.learningContent[aiMsgIndex].isComplete = true;
                                            }
                                            break;
                                        }
                                    } catch (e) {
                                        console.error('解析SSE数据失败:', e, line);
                                    }
                                }
                            }
                        }

                    } else {
                        // 问答使用stream-qa接口
                        // 使用EventSource
                        this.eventSource = new EventSource(`/api/learn/stream-qa?session=${this.sessionId}&question=${encodeURIComponent(userMessage)}`);

                        this.eventSource.onmessage = (event) => {
                            try {
                                const data = JSON.parse(event.data);

                                if (data.type === 'content' && data.content) {
                                    // 更新AI消息内容
                                    const aiMsgIndex = this.qaContent.findIndex(msg => msg.id === aiMsgId);
                                    if (aiMsgIndex !== -1) {
                                        this.qaContent[aiMsgIndex].fullContent += data.content;
                                        this.qaContent[aiMsgIndex].content = this.qaContent[aiMsgIndex].fullContent;
                                        this.scrollToBottom();
                                        this.highlightCode();
                                    }
                                } else if (data.type === 'end') {
                                    // 流结束
                                    const aiMsgIndex = this.qaContent.findIndex(msg => msg.id === aiMsgId);
                                    if (aiMsgIndex !== -1) {
                                        this.qaContent[aiMsgIndex].isComplete = true;
                                    }

                                    this.eventSource.close();
                                    this.eventSource = null;
                                }
                            } catch (e) {
                                console.error('处理QA SSE消息时出错:', e);
                            }
                        };

                        this.eventSource.onerror = (error) => {
                            console.error('QA SSE连接错误:', error);
                            this.eventSource.close();
                            this.eventSource = null;
                        };
                    }

                } catch (error) {
                    console.error('发送请求失败:', error);
                    this.$message.error('发送请求失败，请稍后重试');
                } finally {
                    this.chatLoading = false;
                    this.scrollToBottom();
                    this.highlightCode();
                }
            },

            // 获取学习历史记录的辅助方法
            getLearningHistory() {
                // 获取最近的5条消息作为上下文，简化负载
                const recentMessages = this.learningContent.slice(-5);
                return recentMessages.map(msg => {
                    return {
                        role: msg.type === 'ai' ? 'assistant' : 'user',
                        content: msg.type === 'ai' ? (msg.fullContent || msg.content) : msg.content
                    };
                });
            },
            // 保存学习记录方法
            saveRecord() {
                // 准备要保存的内容 - 合并学习和问答记录
                const recordContent = {
                    learning: this.learningContent,
                    qa: this.qaContent
                };

                if (this.learningContent.length === 0 && this.qaContent.length === 0) {
                    this.$message.warning('没有可保存的记录内容');
                    return;
                }

                // 获取标题 - 使用选定的标签，如果没有则使用默认标题
                const title = this.selectedTags.length > 0
                    ? this.selectedTags.join(',')
                    : '未命名学习记录';

                // 准备请求数据
                const recordData = {
                    title: title,
                    record: JSON.stringify(recordContent),
                    autoGenerateNote: this.autoGenerateNote,
                    tags: this.selectedTags  // 添加标签数据
                };

                // 显示加载状态
                const loading = this.$loading({
                    lock: true,
                    text: '正在保存记录...',
                    spinner: 'el-icon-loading',
                    background: 'rgba(0, 0, 0, 0.7)'
                });

                // 发送保存请求 - 移除JWT认证相关代码，依赖于会话Cookie
                fetch('/api/study/save_record', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(recordData),
                    // 确保发送和接收Cookie
                    credentials: 'same-origin'
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.code === 200) {
                            this.$message({
                                message: '学习记录保存成功',
                                type: 'success'
                            });

                            // 如果选择了保存后清空上下文
                            if (this.clearContextAfterSave) {
                                this.learningContent = [];
                                this.qaContent = [];

                                // 重置状态
                                this.activeStep = 0;
                                this.promptStatus = 'wait';
                                this.learningStatus = 'wait';
                                this.qaStatus = 'wait';

                                // 清空会话ID，强制重新开始
                                this.sessionId = null;
                            }
                        } else {
                            this.$message.error(data.message || '保存失败');
                        }
                    })
                    .catch(error => {
                        console.error('保存记录失败:', error);
                        this.$message.error('保存记录时发生错误');
                    })
                    .finally(() => {
                        loading.close();
                    });
            },
            
        },

        // 组件挂载后的钩子函数
        mounted() {
            // 如果需要执行任何初始化
            console.log('学习组件已挂载');
        },
        // 组件销毁前的钩子函数，确保资源被正确清理
        beforeUnmount() {
            // 关闭EventSource连接
            if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = null;
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

    app.use(ElementPlus);

    if (window.ElementPlusIconsVue) {
        for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
            app.component(key, component);
        }
    } else {
        console.error('ElementPlusIconsVue 未加载，请确认相关库的引入');
    }

    app.mount('#app');
});