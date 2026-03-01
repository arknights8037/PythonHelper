document.addEventListener('DOMContentLoaded', () => {
    // Vue应用初始化
    const app = Vue.createApp({
        // 数据
        data() {
            return {
                currentPage: '/homepage',
                viewMode: 'all',
                posts: [],
                page: 1,
                pageSize: 15,
                loading: true,
                loadingMore: false,
                noMorePosts: false,
                searchQuery: '',
                filterOption: 'latest',
                showPostDialog: false,
                newPost: {
                    title: '',
                    content: ''
                },
                submitting: false,
                
                // 添加学习统计相关数据
                learningStats: {
                    loading: true,
                    error: false,
                    data: [],
                    weeks: [] // 按周分组的数据，用于渲染热力图
                }
            }
        },
        
        // 方法
        methods: {
            // 导航
            navigateTo(path) {
                window.location.href = path;
            },
            
            // 下载Python
            downloadPython() {
                window.open('https://www.python.org/downloads/', '_blank');
            },
            
            // 下载VSCode
            downloadVSCode() {
                window.open('https://code.visualstudio.com/download', '_blank');
            },
            
            // 获取帖子
            fetchPosts(refresh = false) {
                if (refresh) {
                    this.page = 1;
                    this.posts = [];
                    this.noMorePosts = false;
                    this.loading = true;
                } else {
                    this.loadingMore = true;
                }
                
                // 构建请求参数
                const params = {
                    page: this.page,
                    page_size: this.pageSize,
                    mode: this.viewMode
                };
                
                // 如果是自定义查看模式，添加搜索和筛选参数
                if (this.viewMode === 'custom') {
                    params.search = this.searchQuery;
                    params.filter = this.filterOption;
                }
                
                // 发送请求
                axios.get('/homepage/posts', { params })
                    .then(response => {
                        const result = response.data;
                        if (result && result.posts) {
                            // 追加或替换帖子列表
                            if (refresh) {
                                this.posts = result.posts;
                            } else {
                                this.posts = [...this.posts, ...result.posts];
                            }
                            
                            // 判断是否还有更多数据
                            if (result.posts.length < this.pageSize) {
                                this.noMorePosts = true;
                            } else {
                                this.page++;
                            }
                        } else {
                            this.noMorePosts = true;
                        }
                    })
                    .catch(error => {
                        console.error('获取帖子失败:', error);
                        ElementPlus.ElMessage.error('获取帖子失败，请稍后重试');
                    })
                    .finally(() => {
                        this.loading = false;
                        this.loadingMore = false;
                    });
            },
            
            // 处理滚动加载
            handleScroll(event) {
                const container = event.target;
                const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
                
                // 当滚动到底部50px时加载更多
                if (scrollBottom < 50 && !this.loading && !this.loadingMore && !this.noMorePosts) {
                    this.fetchPosts();
                }
            },
            
            // 应用筛选
            applyFilter() {
                this.fetchPosts(true);
            },
            
            // 提交新帖子
            submitPost() {
                // 表单验证
                if (!this.newPost.title.trim()) {
                    ElementPlus.ElMessage.warning('请输入帖子标题');
                    return;
                }
                
                if (!this.newPost.content.trim()) {
                    ElementPlus.ElMessage.warning('请输入帖子内容');
                    return;
                }
                
                this.submitting = true;
                
                // 发送请求
                axios.post('/homepage/post', this.newPost)
                    .then(response => {
                        const result = response.data;
                        if (result && result.success) {
                            ElementPlus.ElMessage.success('发布成功');
                            this.showPostDialog = false;
                            this.newPost = { title: '', content: '' };
                            // 刷新帖子列表
                            this.fetchPosts(true);
                        } else {
                            ElementPlus.ElMessage.error(result.message || '发布失败');
                        }
                    })
                    .catch(error => {
                        console.error('发布帖子失败:', error);
                        ElementPlus.ElMessage.error('发布失败，请稍后重试');
                    })
                    .finally(() => {
                        this.submitting = false;
                    });
            },
            
            // 收藏帖子
            favoritePost(post) {
                axios.post('/homepage/favorite', { topic_id: post.topic_id })
                    .then(response => {
                        const result = response.data;
                        if (result && result.success) {
                            if (result.action === 'add') {
                                ElementPlus.ElMessage.success('收藏成功');
                                post.favorite_count = (post.favorite_count || 0) + 1;
                            } else {
                                ElementPlus.ElMessage.info('已取消收藏');
                                post.favorite_count = Math.max((post.favorite_count || 1) - 1, 0);
                            }
                        } else {
                            ElementPlus.ElMessage.error(result.message || '操作失败');
                        }
                    })
                    .catch(error => {
                        console.error('收藏操作失败:', error);
                        ElementPlus.ElMessage.error('操作失败，请稍后重试');
                    });
            },
            
            // 评论帖子
            commentPost(post) {
                // 评论功能占位，可以打开评论对话框或跳转到详情页
                ElementPlus.ElMessage.info('评论功能开发中');
            },
            
            // 获取学习统计数据
            fetchLearningStats() {
                this.learningStats.loading = true;
                this.learningStats.error = false;
                
                axios.get('/homepage/learn-stats')
                    .then(response => {
                        const result = response.data;
                        if (result && result.success) {
                            this.learningStats.data = result.data;
                            this.processHeatmapData();
                        } else {
                            this.learningStats.error = true;
                        }
                    })
                    .catch(error => {
                        console.error('获取学习统计数据失败:', error);
                        this.learningStats.error = true;
                    })
                    .finally(() => {
                        this.learningStats.loading = false;
                    });
            },
            
            // 处理热力图数据，按周分组
            processHeatmapData() {
                if (!this.learningStats.data.length) return;
                
                const weeks = [];
                let currentWeek = [];
                
                // 确定第一天是周几
                const firstDate = new Date(this.learningStats.data[0].date);
                const firstDayOfWeek = firstDate.getDay(); // 0是周日，1是周一，以此类推
                
                // 前面补充空白天 - 使用空对象而不是null
                for (let i = 0; i < firstDayOfWeek; i++) {
                    currentWeek.push({ date: '', count: 0 });  // 改为空对象，有count属性
                }
                
                // 填充实际数据
                this.learningStats.data.forEach(day => {
                    const date = new Date(day.date);
                    const dayOfWeek = date.getDay();
                    
                    if (dayOfWeek === 0 && currentWeek.length > 0) {
                        // 周日，结束当前周并开始新的一周
                        weeks.push([...currentWeek]);
                        currentWeek = [];
                    }
                    
                    currentWeek.push(day);
                    
                    if (currentWeek.length === 7) {
                        // 一周结束，保存当前周
                        weeks.push([...currentWeek]);
                        currentWeek = [];
                    }
                });
                
                // 处理最后一周（如果不完整）
                if (currentWeek.length > 0) {
                    // 补充剩余的空白天
                    while (currentWeek.length < 7) {
                        currentWeek.push({ date: '', count: 0 });  // 使用空对象，有count属性
                    }
                    weeks.push(currentWeek);
                }
                
                this.learningStats.weeks = weeks;
            },
            
            // 根据记录数量获取热力图颜色样式
            getHeatmapStyle(count) {
                // 确保count是有效数字
                if (count === undefined || count === null || isNaN(count)) {
                    return { backgroundColor: '#ebedf0' }; // 默认颜色
                }
                
                // 确保count是数字
                count = Number(count);
                
                if (count === 0) {
                    return { backgroundColor: '#ebedf0' };
                } else if (count === 1) {
                    return { backgroundColor: '#9be9a8' };
                } else if (count === 2) {
                    return { backgroundColor: '#40c463' };
                } else if (count >= 3 && count <= 5) {
                    return { backgroundColor: '#30a14e' };
                } else {
                    return { backgroundColor: '#216e39' };
                }
            }
        },
        
        // 监听器
        watch: {
            viewMode(newVal) {
                // 视图模式变更时刷新数据
                this.fetchPosts(true);
            }
        },
        
        // 生命周期钩子
        mounted() {
            // 设置当前活动页面
            this.currentPage = window.location.pathname;
            
            // 初始化加载帖子数据
            this.fetchPosts();
            
            // 初始化加载学习统计数据
            this.fetchLearningStats();
        }
    });
    
   // 使用Element Plus
   app.use(ElementPlus);
    
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

   // 添加新的图标组件
   app.component('el-icon-edit', {
       template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M832 512a32 32 0 1 1 64 0v352a32 32 0 0 1-32 32H160a32 32 0 0 1-32-32V160a32 32 0 0 1 32-32h352a32 32 0 0 1 0 64H192v640h640V512z"></path><path fill="currentColor" d="m469.952 554.24 52.8-7.552L847.104 222.4a32 32 0 1 0-45.248-45.248L477.44 501.44l-7.552 52.8zm422.4-422.4a96 96 0 0 1 0 135.808l-331.84 331.84a32 32 0 0 1-18.112 9.088L436.8 623.68a32 32 0 0 1-36.224-36.224l15.104-105.6a32 32 0 0 1 9.024-18.112l331.904-331.84a96 96 0 0 1 135.744 0z"></path></svg>`
   });
   
   app.component('el-icon-download', {
       template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M160 832h704a32 32 0 1 1 0 64H160a32 32 0 1 1 0-64zm384-253.696 236.288-236.352 45.248 45.248L508.8 704 192 387.2l45.248-45.248L480 584.704V128h64v450.304z"></path></svg>`
   });
   
   app.component('el-icon-search', {
       template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M795.904 750.72 602.112 556.032a202.24 202.24 0 0 0 48.128-188.608c-15.52-55.744-55.04-102.72-115.584-124.8-41.472-15.36-85.76-16.832-129.152-1.92a216.064 216.064 0 0 0-133.76 98.88 200.864 200.864 0 0 0-26.88 201.92c15.36 55.68 54.72 102.72 115.52 124.8 40.96 15.36 85.76 16.832 129.12 1.92a212.736 212.736 0 0 0 79.36-45.76l195.968 196.032a32 32 0 1 0 45.248-45.248zM359.552 599.232a152.832 152.832 0 0 1-115.84-124.16 152.832 152.832 0 0 1 25.6-115.84 152.896 152.896 0 0 1 104.32-50.048 157.44 157.44 0 0 1 106.88 19.2c47.68 26.88 79.36 71.68 89.6 124.16a154.88 154.88 0 0 1-25.6 115.84 152.896 152.896 0 0 1-104.32 50.048 157.44 157.44 0 0 1-80.64-19.2z"></path></svg>`
   });
   
   app.component('el-icon-star', {
       template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="m512 747.84 228.16 119.936a6.4 6.4 0 0 0 9.28-6.72l-43.52-254.08 184.512-179.904a6.4 6.4 0 0 0-3.52-10.88l-255.104-37.12L517.76 147.904a6.4 6.4 0 0 0-11.52 0L392.192 379.072l-255.104 37.12a6.4 6.4 0 0 0-3.52 10.88L318.08 606.976l-43.584 254.08a6.4 6.4 0 0 0 9.28 6.72L512 747.84zM313.6 924.48a70.4 70.4 0 0 1-102.144-74.24l37.888-220.928L88.96 472.96A70.4 70.4 0 0 1 128 352.896l221.76-32.256 99.2-200.96a70.4 70.4 0 0 1 126.208 0l99.2 200.96 221.824 32.256a70.4 70.4 0 0 1 39.04 120.064l-160.32 156.416 37.888 220.928a70.4 70.4 0 0 1-102.144 74.24L512 841.984l-198.4 82.496z"></path></svg>`
   });
   
   app.component('el-icon-chat', {
       template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M704 640v64H256v-64h448zm0-192v64H256v-64h448zm-448-128h448v64H256v-64zm0-128h448v64H256v-64zm576-128v832H128V96l704 64zm64-22.4L704.128 32H192v896h768v-850.56l-128-11.84z"></path></svg>`
   });
   
   app.component('el-icon-loading', {
       template: `<svg class="rotating" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M512 64a32 32 0 0 1 32 32v192a32 32 0 0 1-64 0V96a32 32 0 0 1 32-32zm0 640a32 32 0 0 1 32 32v192a32 32 0 1 1-64 0V736a32 32 0 0 1 32-32zm448-192a32 32 0 0 1-32 32H736a32 32 0 1 1 0-64h192a32 32 0 0 1 32 32zm-640 0a32 32 0 0 1-32 32H96a32 32 0 0 1 0-64h192a32 32 0 0 1 32 32zM195.2 195.2a32 32 0 0 1 45.248 0L376.32 331.008a32 32 0 0 1-45.248 45.248L195.2 240.448a32 32 0 0 1 0-45.248zm452.544 452.544a32 32 0 0 1 45.248 0L828.8 783.552a32 32 0 0 1-45.248 45.248L647.744 692.992a32 32 0 0 1 0-45.248zM828.8 195.264a32 32 0 0 1 0 45.184L692.992 376.32a32 32 0 0 1-45.248-45.248l135.808-135.808a32 32 0 0 1 45.248 0zm-452.544 452.48a32 32 0 0 1 0 45.248L240.448 828.8a32 32 0 0 1-45.248-45.248l135.808-135.808a32 32 0 0 1 45.248 0z"></path></svg>`
   });

   // 注册分段控制组件
   app.component('el-segmented-control', {
       props: {
           modelValue: String
       },
       emits: ['update:modelValue'],
       template: `<div class="el-segmented-control">
           <slot></slot>
       </div>`,
       mounted() {
           // 将子组件的选择传递给父组件
           const options = this.$el.querySelectorAll('.el-segmented-control-option');
           for (let option of options) {
               if (option.__vue__ && option.__vue__.value === this.modelValue) {
                   option.classList.add('is-active');
               }
           }
       }
   });

   app.component('el-segmented-control-option', {
       props: {
           label: String,
           value: String
       },
       template: `<div class="el-segmented-control-option" @click="select">{{ label }}</div>`,
       methods: {
           select() {
               // 通知父组件发生了选择
               let parent = this.$parent;
               if (parent.$emit) {
                   parent.$emit('update:modelValue', this.value);

                   // 移除其他选项的活跃状态，设置当前选项为活跃
                   const options = parent.$el.querySelectorAll('.el-segmented-control-option');
                   for (let option of options) {
                       option.classList.remove('is-active');
                   }
                   this.$el.classList.add('is-active');
               }
           }
       }
   });

   // 设置到全局变量
   window.ElementPlusIcons = app._context.components;
   
   // 挂载应用
   app.mount('#app');

   // 检查库加载状态
   setTimeout(() => typeof displayLibraryStatus === 'function' && displayLibraryStatus(), 500);
});