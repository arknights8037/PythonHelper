from flask import Blueprint, request, jsonify, session
from werkzeug.security import check_password_hash
from ..model import db, UserInfo, FeedBack
import re
from datetime import timedelta,datetime
from app.utils.auth import login_required
import json
import uuid
# 创建Blueprint
user_bp = Blueprint('user', __name__)

@user_bp.route('/login', methods=['POST'])
def login():
    """用户登录接口"""
    data = request.get_json()
    
    # 验证请求数据
    if not data or not data.get('uid') or not data.get('password'):
        return jsonify({
            'code': 400,
            'message': '请提供用户名和密码'
        })
    
    uid = data.get('uid')
    password = data.get('password')
    remember_me = data.get('remember_me', False)
    
    # 查询用户
    user = UserInfo.query.filter_by(uid=uid).first()
    
    # 验证用户和密码
    if not user or not user.check_password(password):
        return jsonify({
            'code': 401,
            'message': '用户名或密码错误'
        })
    
    # 设置会话数据
    session['uid'] = user.uid
    session['nickname'] = user.nickname
    session['is_admin'] = user.admin
    
    # 如果选择记住我，设置较长的会话过期时间
    if remember_me:
        session.permanent = True
        # 30天会话期限
        session.permanent_session_lifetime = timedelta(days=30)
    
    return jsonify({
        'code': 200,
        'message': '登录成功',
        'data': user.to_dict()
    })

@user_bp.route('/register', methods=['POST'])
def register():
    """用户注册接口"""
    data = request.get_json()
    
    # 验证请求数据
    if not data or not data.get('uid') or not data.get('password') or not data.get('nickname'):
        return jsonify({
            'code': 400,
            'message': '请提供完整的注册信息'
        })
    
    uid = data.get('uid')
    password = data.get('password')
    nickname = data.get('nickname')
    
    # 验证用户ID格式（例如：只允许字母、数字和下划线）
    if not re.match(r'^[a-zA-Z0-9_]{4,20}$', uid):
        return jsonify({
            'code': 400,
            'message': '用户ID只能包含字母、数字和下划线，长度为4-20个字符'
        })
    
    # 验证密码强度
    if len(password) < 6:
        return jsonify({
            'code': 400,
            'message': '密码长度不能少于6位'
        })
    
    # 检查用户是否已存在
    existing_user = UserInfo.query.filter_by(uid=uid).first()
    if existing_user:
        return jsonify({
            'code': 409,
            'message': '该用户ID已被注册'
        })
    
    # 创建新用户
    try:
        new_user = UserInfo(uid=uid, password=password, nickname=nickname)
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'code': 200,
            'message': '注册成功'
        })
    except Exception as e:
        db.session.rollback()
        print(f"用户注册失败: {e}")
        return jsonify({
            'code': 500,
            'message': '注册失败，请稍后再试'
        })

@user_bp.route('/logout', methods=['POST'])
def logout():
    """用户退出登录"""
    session.clear()
    return jsonify({
        'code': 200,
        'message': '成功退出登录'
    })

@user_bp.route('/info', methods=['GET'])
def user_info():
    """获取当前登录用户信息"""
    if 'uid' not in session:
        return jsonify({
            'code': 401,
            'message': '用户未登录'
        })
    
    uid = session.get('uid')
    user = UserInfo.query.filter_by(uid=uid).first()
    
    if not user:
        session.clear()
        return jsonify({
            'code': 401,
            'message': '用户不存在或已被删除'
        })
    
    return jsonify({
        'code': 200,
        'message': '获取成功',
        'data': user.to_dict()
    })

@user_bp.route('/check-auth', methods=['GET'])
def check_auth():
    """检查用户是否已登录"""
    if 'uid' in session:
        return jsonify({
            'code': 200,
            'message': '用户已登录',
            'authenticated': True
        })
    else:
        return jsonify({
            'code': 200,
            'message': '用户未登录',
            'authenticated': False
        })
    
@user_bp.route('/profile', methods=['GET'])
@login_required
def get_user_profile():
    try:
        uid = session.get('uid')
        user = UserInfo.query.get(uid)
        
        if not user:
            return jsonify({'code': 1, 'msg': '用户不存在'})
        
        return jsonify({'code': 0, 'msg': '成功', 'data': user.to_dict()})
    except Exception as e:
        return jsonify({'code': 1, 'msg': f'获取用户信息失败: {str(e)}'})

# 更新用户信息接口
@user_bp.route('/update_profile', methods=['POST'])
@login_required
def update_profile():
    try:
        uid = session.get('uid')
        user = UserInfo.query.get(uid)
        
        if not user:
            return jsonify({'code': 1, 'msg': '用户不存在'})
        
        data = request.get_json()
        nickname = data.get('nickname')
        
        if nickname:
            user.nickname = nickname
            db.session.commit()
            
        return jsonify({'code': 0, 'msg': '用户信息更新成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'code': 1, 'msg': f'更新用户信息失败: {str(e)}'})

# 提交调查问卷接口
from datetime import datetime

# 提交调查问卷接口
@user_bp.route('/submit_survey', methods=['POST'])
@login_required
def submit_survey():
    try:
        uid = session.get('uid')
        user = UserInfo.query.get(uid)
        
        if not user:
            return jsonify({'code': 1, 'msg': '用户不存在'})
        
        # 获取问卷数据
        data = request.get_json()
        
        # 存储到用户画像字段，包含所有表单信息
        user_persona = {
            'python经验': data.get('experience', ''),
            '其他编程语言基础': data.get('otherLanguages', []),
            '编程经验': data.get('programmingExperience', ''),
            '身份': data.get('identity', ''),
            '学习目标': data.get('goals', []),
            '提交时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            '问卷版本': '1.0'
        }
        
        # 检查是否存在现有画像数据
        existing_persona = {}
        if user.persona:
            try:
                existing_persona = json.loads(user.persona)
            except:
                # 如果解析失败，使用空字典
                pass
                
        # 合并现有画像与新数据
        existing_persona.update(user_persona)
        
        # 将用户画像保存为JSON字符串，确保正确处理中文
        user.persona = json.dumps(existing_persona, ensure_ascii=False)
        db.session.commit()
        
        return jsonify({'code': 0, 'msg': '问卷提交成功'})
    except Exception as e:
        db.session.rollback()
        print(f"提交问卷失败: {str(e)}")  # 记录详细错误
        return jsonify({'code': 1, 'msg': f'问卷提交失败: {str(e)}'})

# 修改密码接口
@user_bp.route('/change_password', methods=['POST'])
@login_required
def change_password():
    try:
        uid = session.get('uid')
        user = UserInfo.query.get(uid)
        
        if not user:
            return jsonify({'code': 1, 'msg': '用户不存在'})
        
        data = request.get_json()
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        
        # 验证旧密码
        if not user.check_password(old_password):
            return jsonify({'code': 1, 'msg': '当前密码不正确'})
        
        # 设置新密码
        user.set_password(new_password)
        db.session.commit()
        
        return jsonify({'code': 0, 'msg': '密码修改成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'code': 1, 'msg': f'密码修改失败: {str(e)}'})

# 提交反馈接口
@user_bp.route('/submit_feedback', methods=['POST'])
@login_required
def submit_feedback():
    try:
        uid = session.get('uid')
        # 检查用户是否存在
        user = UserInfo.query.get(uid)
        if not user:
            return jsonify({'code': 1, 'msg': '用户不存在'})
        
        data = request.get_json()
        title = data.get('title')
        content = data.get('content')
        
        # 生成反馈ID
        fid = f"fb_{uuid.uuid4().hex[:16]}"
        
        # 创建反馈记录
        feedback = FeedBack(fid=fid, title=title, content=content)
        db.session.add(feedback)
        db.session.commit()
        
        return jsonify({'code': 0, 'msg': '反馈提交成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'code': 1, 'msg': f'反馈提交失败: {str(e)}'})

# 获取用户反馈列表
@user_bp.route('/feedback_list', methods=['GET'])
@login_required
def get_feedback_list():
    try:
        # 这里简单实现，获取所有反馈
        # 实际应用中应该过滤出当前用户的反馈
        feedback_list = FeedBack.query.order_by(FeedBack.creattime.desc()).all()
        result = [feedback.to_dict() for feedback in feedback_list]
        
        return jsonify({'code': 0, 'msg': '成功', 'data': result})
    except Exception as e:
        return jsonify({'code': 1, 'msg': f'获取反馈列表失败: {str(e)}'})