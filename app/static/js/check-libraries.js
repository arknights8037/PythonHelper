/**
 * 检查所有库是否正确加载
 * @returns {Object} 包含每个库检查结果的对象
 */
function checkLibraries() {
    const results = {
        vue: false,
        elementPlus: false,
        axios: false,
        codeMirror: false,
        stackEdit: false
    };
    
    // 检查Vue
    try {
        results.vue = typeof Vue !== 'undefined' && Vue.version && Vue.createApp;
        console.log('Vue检查:', results.vue ? '成功' : '失败', results.vue ? `(版本: ${Vue.version})` : '');
    } catch (e) {
        console.error('Vue检查失败:', e);
    }
    
    // 检查Element Plus
    try {
        results.elementPlus = typeof ElementPlus !== 'undefined';
        console.log('Element Plus检查:', results.elementPlus ? '成功' : '失败');
    } catch (e) {
        console.error('Element Plus检查失败:', e);
    }
    
    // 检查Axios
    try {
        results.axios = typeof axios !== 'undefined' && axios.isAxiosError;
        console.log('Axios检查:', results.axios ? '成功' : '失败');
    } catch (e) {
        console.error('Axios检查失败:', e);
    }
    
    // 检查CodeMirror (同时支持 CodeMirror 5 和 6)
    try {
        // CodeMirror 5 为全局对象，CodeMirror 6 需要检查特定属性
        const cm5Exists = typeof CodeMirror !== 'undefined';
        
        // 尝试检测 CodeMirror 6
        const cm6Module = document.querySelector('script[src*="codemirror.min.js"]');
        const cm6Loaded = cm5Exists || cm6Module;
        
        results.codeMirror = cm6Loaded;
        console.log('CodeMirror检查:', results.codeMirror ? '成功' : '失败', 
            cm5Exists && CodeMirror.version ? `(版本: ${CodeMirror.version})` : 
            cm6Module ? '(版本: CodeMirror 6)' : '');
    } catch (e) {
        console.error('CodeMirror检查失败:', e);
    }
    
    // 检查StackEdit
    try {
        // 检查脚本是否加载
        const stackEditScript = document.querySelector('script[src*="stackedit.min.js"]');
        
        // 检查全局对象 (StackEdit 可能是一个类或者模块)
        const globalStackEditExists = typeof StackEdit !== 'undefined';
        
        // 如果脚本已加载或者全局对象存在，就认为成功
        results.stackEdit = stackEditScript !== null || globalStackEditExists;
        
        console.log('StackEdit检查:', results.stackEdit ? '成功' : '失败', 
            stackEditScript ? '(脚本已加载)' : '',
            globalStackEditExists ? '(全局对象已定义)' : '');
    } catch (e) {
        console.error('StackEdit检查失败:', e);
    }
     
    
    return results;
}

// 检查所有库并显示结果
function displayLibraryStatus() {
    const results = checkLibraries();
    const allLoaded = Object.values(results).every(r => r === true);
    
    // 创建状态信息元素
    const statusDiv = document.createElement('div');
    statusDiv.id = 'library-status';
    statusDiv.style.position = 'fixed';
    statusDiv.style.bottom = '10px';
    statusDiv.style.right = '10px';
    statusDiv.style.padding = '10px';
    statusDiv.style.background = allLoaded ? '#dff0d8' : '#f2dede';
    statusDiv.style.border = `1px solid ${allLoaded ? '#d6e9c6' : '#ebccd1'}`;
    statusDiv.style.borderRadius = '4px';
    statusDiv.style.color = allLoaded ? '#3c763d' : '#a94442';
    statusDiv.style.zIndex = '9999';
    
    // 添加状态信息
    let html = '<h4>库加载状态</h4><ul style="padding-left: 20px; margin: 5px 0;">';
    for (const [lib, status] of Object.entries(results)) {
        const libName = {
            vue: 'Vue',
            elementPlus: 'Element Plus',
            axios: 'Axios',
            codeMirror: 'CodeMirror',
            stackEdit: 'StackEdit'
        }[lib] || lib;
        
        html += `<li>${libName}: ${status ? '✅ 已加载' : '❌ 未加载'}</li>`;
    }
    html += '</ul>';
    
    // 如果有库加载失败，添加故障排除建议
    if (!allLoaded) {
        html += '<div style="margin-top:10px;"><strong>故障排除建议:</strong><ul style="padding-left: 20px; margin: 5px 0;">';
        if (!results.vue) {
            html += '<li>Vue: 检查vue.global.js文件是否存在并可访问</li>';
        }
        if (!results.elementPlus) {
            html += '<li>Element Plus: 检查element-plus.global.js文件</li>';
        }
        if (!results.axios) {
            html += '<li>Axios: 检查axios.min.js文件</li>';
        }
        if (!results.codeMirror) {
            html += '<li>CodeMirror: 检查codemirror.min.js文件，注意CodeMirror 6使用ES模块系统</li>';
        }
        if (!results.stackEdit) {
            html += '<li>StackEdit: ES模块语法需要使用type="module"或已编译版本</li>';
        }
        html += '</ul></div>';
    }
    
    statusDiv.innerHTML = html;
    document.body.appendChild(statusDiv);
    
    // 添加关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '关闭';
    closeBtn.style.marginTop = '5px';
    closeBtn.style.padding = '3px 8px';
    closeBtn.onclick = () => statusDiv.remove();
    statusDiv.appendChild(closeBtn);
    
    // 添加"尝试修复"按钮
    if (!allLoaded) {
        const fixBtn = document.createElement('button');
        fixBtn.innerText = '尝试修复';
        fixBtn.style.marginTop = '5px';
        fixBtn.style.marginLeft = '10px';
        fixBtn.style.padding = '3px 8px';
        fixBtn.onclick = attemptToFixLibraries;
        statusDiv.appendChild(fixBtn);
    }
    
    return results;
}

// 尝试修复库加载问题
function attemptToFixLibraries() {
    const results = checkLibraries();
    
    // 尝试从CDN加载缺失的库
    if (!results.vue) {
        console.log('尝试从CDN加载Vue...');
        loadScript('https://unpkg.com/vue@3/dist/vue.global.js');
    }
    
    if (!results.elementPlus) {
        console.log('尝试从CDN加载Element Plus...');
        loadScript('https://unpkg.com/element-plus');
    }
    
    if (!results.axios) {
        console.log('尝试从CDN加载Axios...');
        loadScript('https://unpkg.com/axios/dist/axios.min.js');
    }
    
    if (!results.codeMirror) {
        console.log('尝试从CDN加载CodeMirror...');
        // 首先尝试加载 CodeMirror 5 (更兼容全局检测)
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js');
    }
    
    if (!results.stackEdit) {
        console.log('尝试从CDN加载StackEdit...');
        loadScript('https://unpkg.com/stackedit-js@1.0.7/docs/lib/stackedit.min.js');
    }
    
    // 清除当前状态显示
    const statusDiv = document.getElementById('library-status');
    if (statusDiv) {
        statusDiv.remove();
    }
    
    // 2秒后重新检查
    setTimeout(() => {
        displayLibraryStatus();
        alert('已尝试修复库加载问题，请查看更新后的状态。');
    }, 2000);
}

// 辅助函数：加载脚本
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}