from flask import Blueprint, request, jsonify, session, g
from ..model import db, Code, UserInfo
from datetime import datetime
import uuid
import json
import subprocess
import tempfile
import sys
code_bp = Blueprint('code', __name__)

# 中间件：检查用户是否已登录
@code_bp.before_request
def check_login():
    # 从session中获取用户ID
    uid = session.get('uid')
    
    # 跳过OPTIONS请求的验证（用于CORS预检请求）
    if request.method == 'OPTIONS':
        return
    
    if not uid:
        return jsonify({'code': 1, 'msg': '请先登录'}), 401
    
    # 加载用户信息
    user = UserInfo.query.get(uid)
    if not user:
        return jsonify({'code': 1, 'msg': '用户不存在'}), 401
    
    # 将用户信息存储在g对象中，以便在其他函数中使用
    g.user = user

# 获取当前用户的所有代码
@code_bp.route('/codes', methods=['GET'])
def get_user_codes():
    user = g.user
    codes = Code.query.filter_by(uid=user.uid).all()
    
    return jsonify({
        'code': 0,
        'msg': 'success',
        'data': [code.to_dict() for code in codes]
    })

# 获取特定代码详情
@code_bp.route('/codes/<string:cid>', methods=['GET'])
def get_code_detail(cid):
    user = g.user
    code = Code.query.filter_by(cid=cid, uid=user.uid).first()
    
    if not code:
        return jsonify({'code': 1, 'msg': '代码不存在或无权访问'}), 404
    
    return jsonify({
        'code': 0,
        'msg': 'success',
        'data': code.to_dict()
    })

# 获取特定代码的聊天记录
@code_bp.route('/codes/<string:cid>/chat', methods=['GET'])
def get_code_chat(cid):
    user = g.user
    code = Code.query.filter_by(cid=cid, uid=user.uid).first()
    
    if not code:
        return jsonify({'code': 1, 'msg': '代码不存在或无权访问'}), 404
    
    return jsonify({
        'code': 0,
        'msg': 'success',
        'data': code.chatrecord
    })

# 更新特定代码的聊天记录
@code_bp.route('/codes/<string:cid>/chat', methods=['PUT'])
def update_code_chat(cid):
    user = g.user
    code = Code.query.filter_by(cid=cid, uid=user.uid).first()
    
    if not code:
        return jsonify({'code': 1, 'msg': '代码不存在或无权访问'}), 404
    
    data = request.json
    chatrecord = data.get('chatrecord')
    
    if not chatrecord:
        return jsonify({'code': 1, 'msg': '缺少聊天记录'}), 400
    
    try:
        # 验证JSON格式
        json.loads(chatrecord)
        
        code.chatrecord = chatrecord
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'success'
        })
    except json.JSONDecodeError:
        return jsonify({'code': 1, 'msg': '聊天记录格式无效'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'code': 1, 'msg': f'更新失败: {str(e)}'}), 500

# 创建新代码
@code_bp.route('/codes', methods=['POST'])
def create_code():
    user = g.user
    data = request.json
    
    code_content = data.get('code', '')
    chatrecord = data.get('chatrecord', '[]')
    filename = data.get('filename', 'untitled.py')  # 获取文件名，默认为untitled.py
    
    try:
        # 生成唯一ID
        cid = f"{user.uid}_{uuid.uuid4().hex[:8]}_{int(datetime.now().timestamp())}"
        
        # 创建新代码记录
        new_code = Code(
            cid=cid,
            uid=user.uid,
            filename=filename,  # 添加文件名
            code=code_content,
            chatrecord=chatrecord
        )
        
        db.session.add(new_code)
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'success',
            'data': {
                'cid': cid
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'code': 1, 'msg': f'创建失败: {str(e)}'}), 500

# 更新现有代码
@code_bp.route('/codes/<string:cid>', methods=['PUT'])
def update_code(cid):
    user = g.user
    code = Code.query.filter_by(cid=cid, uid=user.uid).first()
    
    if not code:
        return jsonify({'code': 1, 'msg': '代码不存在或无权访问'}), 404
    
    data = request.json
    code_content = data.get('code')
    chatrecord = data.get('chatrecord')
    filename = data.get('filename')  # 获取文件名
    
    try:
        if code_content is not None:
            code.code = code_content
            
        if chatrecord is not None:
            # 验证JSON格式
            json.loads(chatrecord)
            code.chatrecord = chatrecord
        
        if filename is not None:
            code.filename = filename  # 更新文件名
            
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'success'
        })
    except json.JSONDecodeError:
        return jsonify({'code': 1, 'msg': '聊天记录格式无效'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'code': 1, 'msg': f'更新失败: {str(e)}'}), 500

# 删除代码
@code_bp.route('/codes/<string:cid>', methods=['DELETE'])
def delete_code(cid):
    user = g.user
    code = Code.query.filter_by(cid=cid, uid=user.uid).first()
    
    if not code:
        return jsonify({'code': 1, 'msg': '代码不存在或无权访问'}), 404
    
    try:
        db.session.delete(code)
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': 'success'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'code': 1, 'msg': f'删除失败: {str(e)}'}), 500

# 代码运行接口（模拟实现）
@code_bp.route('/run', methods=['POST'])
def run_code():
    data = request.json
    code_content = data.get('code', '')

    if not code_content:
        return jsonify({'code': 1, 'msg': '代码内容不能为空'}), 400

    # 沙箱运行Python代码
    try:
        with tempfile.NamedTemporaryFile('w', suffix='.py', delete=False, encoding='utf-8') as f:
            f.write(code_content)
            temp_path = f.name

        # 只允许执行python，限制时间和输出
        result = subprocess.run(
            [sys.executable, temp_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5,
            check=False,
            encoding='utf-8'
        )
        output = result.stdout + (('\n' + result.stderr) if result.stderr else '')
    except subprocess.TimeoutExpired:
        output = '运行超时：代码执行超过5秒'
    except Exception as e:
        output = f'运行失败: {str(e)}'

    return jsonify({
        'code': 0,
        'msg': 'success',
        'data': {
            'output': output
        }
    })

# AI聊天接口（模拟实现）
@code_bp.route('/chat', methods=['POST'])
def chat_with_ai():
    data = request.json
    message = data.get('message', '')
    code_content = data.get('code', '')
    filename = data.get('filename', '')  # 获取文件名
    
    if not message:
        return jsonify({'code': 1, 'msg': '消息内容不能为空'}), 400
    
    # 这里应该实现与AI对话的逻辑
    # 为了演示，我们返回一个模拟的AI回复
    return jsonify({
        'code': 0,
        'msg': 'success',
        'data': {
            'reply': f'我收到了你的消息："{message}"<br>当前文件 {filename} 的代码长度是 {len(code_content)} 个字符。<br>这是一个模拟的AI回复。'
        }
    })