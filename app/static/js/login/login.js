// 导入所需的Element Plus图标
const { User, Lock, Postcard, Check } = ElementPlusIconsVue
const { ElMessage } = ElementPlus
// 创建Vue应用实例
const app = Vue.createApp({
  data() {
    return {
      // 默认显示登录面板
      activePanel: '登录',
      // 登录表单数据
      loginForm: {
        uid: '',
        password: '',
        rememberMe: false
      },
      // 注册表单数据
      registerForm: {
        uid: '',
        nickname: '',
        password: '',
        confirmPassword: ''
      }
    }
  },
  methods: {
    // 登录表单提交
    submitLogin() {
      console.log("提交的登录表单数据:", this.loginForm);
      // 表单验证
      if (!this.loginForm.uid || !this.loginForm.password) {
        ElMessage.error('用户名和密码不能为空');
        return;
      }

      // 发送登录请求
      axios.post('/api/user/login', {
        uid: this.loginForm.uid,
        password: this.loginForm.password,
        remember_me: this.loginForm.rememberMe
      })
      .then(response => {
        const data = response.data;
        if (data.code === 200) {
          ElMessage.success('登录成功');
          // 如果需要记住用户，存储相关信息到localStorage
          if (this.loginForm.rememberMe) {
            localStorage.setItem('uid', this.loginForm.uid);
          }
          // 重定向到主页或仪表板
          setTimeout(() => {
            window.location.href = '/homepage';
          }, 1000);
        } else {
          ElMessage.error(data.message || '登录失败，请检查用户名和密码');
        }
      })
      .catch(error => {
        console.error('登录请求失败:', error);
        ElMessage.error('服务器错误，请稍后再试');
      });
    },

    // 注册表单提交
    submitRegister() {
      // 表单验证
      if (!this.registerForm.uid || !this.registerForm.nickname || 
          !this.registerForm.password || !this.registerForm.confirmPassword) {
        ElMessage.error('请填写所有必填字段');
        return;
      }

      if (this.registerForm.password !== this.registerForm.confirmPassword) {
        ElMessage.error('两次输入的密码不一致');
        return;
      }

      // 密码强度验证（可选）
      if (this.registerForm.password.length < 6) {
        ElMessage.error('密码长度至少为6位');
        return;
      }

      // 发送注册请求
      axios.post('/api/user/register', {
        uid: this.registerForm.uid,
        nickname: this.registerForm.nickname,
        password: this.registerForm.password
      })
      .then(response => {
        const data = response.data;
        if (data.code === 200) {
          ElMessage.success('注册成功，请登录');
          // 重置表单
          this.registerForm = {
            uid: '',
            nickname: '',
            password: '',
            confirmPassword: ''
          };
          // 切换到登录面板
          this.activePanel = '登录';
        } else {
          ElMessage.error(data.message || '注册失败');
        }
      })
      .catch(error => {
        console.error('注册请求失败:', error);
        ElMessage.error('服务器错误，请稍后再试');
      });
    }
  },
  mounted() {
    // 检查是否有记住的用户信息
    const savedUserId = localStorage.getItem('uid');
    if (savedUserId) {
      this.loginForm.uid = savedUserId;
      this.loginForm.rememberMe = true;
    }
  }
});

// 全局注册Element Plus图标
for (const [key, component] of Object.entries({ User, Lock, Postcard, Check })) {
  app.component(key, component);
}

// 挂载Vue应用
app.use(ElementPlus).mount('#app');