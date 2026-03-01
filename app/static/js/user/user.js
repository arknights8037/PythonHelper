document.addEventListener('DOMContentLoaded', () => {
    // Vue应用初始化
    const app = Vue.createApp({
        data() {
            return {
                message: '用户中心',
                currentPage: window.location.pathname,
                activeMenu: 'profile',
                // 用户信息
                userInfo: {
                    uid: '',
                    nickname: '',
                    admin: 0,
                    signuptime: ''
                },
                // 调查问卷
                surveyForm: {
                    experience: '',
                    otherLanguages: [],
                    programmingExperience: '',
                    identity: '',
                    goals: [],
                    
                },
                // 修改密码表单
                passwordForm: {
                    oldPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                },
                // 密码表单验证规则
                passwordRules: {
                    oldPassword: [
                        { required: true, message: '请输入当前密码', trigger: 'blur' }
                    ],
                    newPassword: [
                        { required: true, message: '请输入新密码', trigger: 'blur' },
                        { min: 6, message: '密码长度不能小于6个字符', trigger: 'blur' }
                    ],
                    confirmPassword: [
                        { required: true, message: '请再次输入新密码', trigger: 'blur' },
                        { 
                            validator: (rule, value, callback) => {
                                if (value !== this.passwordForm.newPassword) {
                                    callback(new Error('两次输入的密码不一致'));
                                } else {
                                    callback();
                                }
                            },
                            trigger: 'blur'
                        }
                    ]
                },
                // 反馈表单
                feedbackForm: {
                    title: '',
                    content: ''
                },
                // 反馈表单验证规则
                feedbackRules: {
                    title: [
                        { required: true, message: '请输入反馈标题', trigger: 'blur' },
                        { max: 50, message: '标题长度不能超过50个字符', trigger: 'blur' }
                    ],
                    content: [
                        { required: true, message: '请输入反馈内容', trigger: 'blur' }
                    ]
                },
                // 历史反馈列表
                feedbackList: []
            }
        },
        methods: {
            // 顶部导航跳转
            navigateTo(path) {
                window.location.href = path;
            },
            // 左侧菜单选择
            handleMenuSelect(key) {
                this.activeMenu = key;
                if (key === 'feedback') {
                    this.loadFeedbackList();
                }
            },
            // 加载用户信息
            async loadUserInfo() {
                try {
                    const response = await axios.get('/api/user/profile');
                    if (response.data.code === 0) {
                        this.userInfo = response.data.data;
                    } else {
                        this.$message.error(response.data.msg || '获取用户信息失败');
                    }
                } catch (error) {
                    console.error('加载用户信息失败:', error);
                    this.$message.error('获取用户信息失败，请检查网络连接');
                }
            },
            // 更新用户信息
            async updateProfile() {
                try {
                    const response = await axios.post('/api/user/update_profile', {
                        nickname: this.userInfo.nickname
                    });
                    if (response.data.code === 0) {
                        this.$message.success('个人信息更新成功');
                    } else {
                        this.$message.error(response.data.msg || '更新个人信息失败');
                    }
                } catch (error) {
                    console.error('更新用户信息失败:', error);
                    this.$message.error('更新个人信息失败，请检查网络连接');
                }
            },
            // 提交调查问卷
            async submitSurvey() {
                try {
                    const response = await axios.post('/api/user/submit_survey', this.surveyForm);
                    if (response.data.code === 0) {
                        this.$message.success('问卷提交成功');
                        this.resetSurvey();
                    } else {
                        this.$message.error(response.data.msg || '问卷提交失败');
                    }
                } catch (error) {
                    console.error('提交问卷失败:', error);
                    this.$message.error('问卷提交失败，请检查网络连接');
                }
            },
            // 重置调查问卷
            resetSurvey() {
                this.surveyForm = {
                    experience: '',
                    otherLanguages: [],
                    programmingExperience: '',
                    identity: '',
                    goals: [],
                    
                };
                this.$message({
                    message: '问卷已重置',
                    type: 'info'
                });
            },
            // 修改密码
            async updatePassword() {
                this.$refs.passwordFormRef.validate(async (valid) => {
                    if (valid) {
                        try {
                            const response = await axios.post('/api/user/change_password', {
                                old_password: this.passwordForm.oldPassword,
                                new_password: this.passwordForm.newPassword
                            });
                            if (response.data.code === 0) {
                                this.$message.success('密码修改成功');
                                this.resetPasswordForm();
                            } else {
                                this.$message.error(response.data.msg || '密码修改失败');
                            }
                        } catch (error) {
                            console.error('密码修改失败:', error);
                            this.$message.error('密码修改失败，请检查网络连接');
                        }
                    }
                });
            },
            // 重置密码表单
            resetPasswordForm() {
                this.$refs.passwordFormRef.resetFields();
            },
            // 提交反馈
            async submitFeedback() {
                this.$refs.feedbackFormRef.validate(async (valid) => {
                    if (valid) {
                        try {
                            const response = await axios.post('/api/user/submit_feedback', this.feedbackForm);
                            if (response.data.code === 0) {
                                this.$message.success('反馈提交成功');
                                this.resetFeedbackForm();
                                this.loadFeedbackList();
                            } else {
                                this.$message.error(response.data.msg || '反馈提交失败');
                            }
                        } catch (error) {
                            console.error('提交反馈失败:', error);
                            this.$message.error('反馈提交失败，请检查网络连接');
                        }
                    }
                });
            },
            // 重置反馈表单
            resetFeedbackForm() {
                this.$refs.feedbackFormRef.resetFields();
            },
            // 加载历史反馈
            async loadFeedbackList() {
                try {
                    const response = await axios.get('/api/user/feedback_list');
                    if (response.data.code === 0) {
                        this.feedbackList = JSON.parse(JSON.stringify(response.data.data));
                    } else {
                        this.$message.error(response.data.msg || '获取反馈列表失败');
                    }
                } catch (error) {
                    console.error('加载反馈列表失败:', error);
                    this.$message.error('获取反馈列表失败，请检查网络连接');
                }
                console.log(this.feedbackList);
            },
            viewFeedbackDetail(row) {
                console.log("查看反馈详情:", row);
                this.$message({
                    message: row.content,
                    type: 'info',
                    duration: 0,
                    showClose: true
                });
            }
        },
        mounted() {
            this.currentPage = window.location.pathname;
            this.loadUserInfo();
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
    app.component('el-icon-lock', {
        template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M224 448a32 32 0 0 0-32 32v384a32 32 0 0 0 32 32h576a32 32 0 0 0 32-32V480a32 32 0 0 0-32-32H224zm0-64h576a96 96 0 0 1 96 96v384a96 96 0 0 1-96 96H224a96 96 0 0 1-96-96V480a96 96 0 0 1 96-96z"></path><path fill="currentColor" d="M512 544a32 32 0 0 1 32 32v192a32 32 0 1 1-64 0V576a32 32 0 0 1 32-32zm192-160v-64a192 192 0 1 0-384 0v64h384zM512 64a256 256 0 0 1 256 256v128H256V320A256 256 0 0 1 512 64z"></path></svg>`
    });
    app.component('el-icon-message', {
        template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M128 224v512a64 64 0 0 0 64 64h640a64 64 0 0 0 64-64V224H128zm0-64h768a64 64 0 0 1 64 64v512a128 128 0 0 1-128 128H192A128 128 0 0 1 64 736V224a64 64 0 0 1 64-64z"></path><path fill="currentColor" d="M904 224 656.512 506.88a192 192 0 0 1-289.024 0L120 224h784zm-698.944 0 210.56 240.704a128 128 0 0 0 192.704 0L818.944 224H205.056z"></path></svg>`
    });
    app.component('el-icon-chat-dot-round', {
        template: `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="m174.72 855.68 135.296-45.12 23.68 11.84C388.096 849.536 448.576 864 512 864c211.84 0 384-166.784 384-352S723.84 160 512 160 128 326.784 128 512c0 69.12 24.96 139.264 70.848 199.232l22.08 28.8-46.272 115.584zm-45.248 82.56A32 32 0 0 1 89.6 896l58.368-145.92C94.72 680.32 64 596.864 64 512 64 299.904 256 96 512 96s448 203.904 448 416-192 416-448 416a461.056 461.056 0 0 1-206.912-48.384l-175.616 58.56z"></path><path fill="currentColor" d="M512 563.2a51.2 51.2 0 1 1 0-102.4 51.2 51.2 0 0 1 0 102.4zm192 0a51.2 51.2 0 1 1 0-102.4 51.2 51.2 0 0 1 0 102.4zm-384 0a51.2 51.2 0 1 1 0-102.4 51.2 51.2 0 0 1 0 102.4z"></path></svg>`
    });

    app.use(ElementPlus);
    app.mount('#app');
});