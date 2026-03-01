from flask import Blueprint, request, jsonify, current_app, session
from werkzeug.utils import secure_filename
import os
import uuid
import datetime
from ..model import db, Note
import re

note_bp = Blueprint('note', __name__)

# 获取笔记列表
@note_bp.route('/api/note/list', methods=['GET'])
def get_note_list():
    # 从会话或请求参数中获取用户ID
    uid = session.get('uid') or request.args.get('uid')
    
    # 如果没有uid，使用测试用户ID或返回空列表
    if not uid:
        return jsonify({
            'code': 0,
            'msg': '获取笔记列表成功',
            'data': []
        })
    
    try:
        notes = Note.query.filter_by(uid=uid).all()
        note_list = [note.to_dict() for note in notes]
        
        return jsonify({
            'code': 0,
            'msg': '获取笔记列表成功',
            'data': note_list
        })
    except Exception as e:
        current_app.logger.error(f"获取笔记列表错误: {str(e)}")
        return jsonify({
            'code': 1,
            'msg': f'获取笔记列表失败: {str(e)}'
        }), 500

# 获取笔记详情
@note_bp.route('/api/note/detail/<nid>', methods=['GET'])
def get_note_detail(nid):
    # 从会话或请求参数中获取用户ID
    uid = session.get('uid') or request.args.get('uid')
    
    try:
        # 如果提供了uid，则检查权限
        if uid:
            note = Note.query.filter_by(nid=nid, uid=uid).first()
        else:
            # 简化起见，如果没有uid，直接通过nid获取笔记
            note = Note.query.filter_by(nid=nid).first()
        
        if not note:
            return jsonify({
                'code': 1,
                'msg': '笔记不存在'
            }), 404
        
        return jsonify({
            'code': 0,
            'msg': '获取笔记详情成功',
            'data': note.to_dict()
        })
    except Exception as e:
        current_app.logger.error(f"获取笔记详情错误: {str(e)}")
        return jsonify({
            'code': 1,
            'msg': f'获取笔记详情失败: {str(e)}'
        }), 500

# 创建笔记
@note_bp.route('/api/note/create', methods=['POST'])
def create_note():
    # 从会话或请求数据中获取用户ID
    uid = session.get('uid') or request.json.get('uid')
    
    # 如果没有uid，使用测试用户ID
    uid = uid or 'test-user'
    
    data = request.json
    
    try:
        # 生成唯一ID
        nid = str(uuid.uuid4())
        
        # 创建新笔记
        note = Note(
            nid=nid,
            uid=uid,
            title=data.get('title', '新笔记'),
            abstract=data.get('abstract', ''),
            content=data.get('content', ''),
            state=data.get('state', 'editing'),
            top=data.get('top', 0),
            collection=data.get('collection', 0),
            tag=data.get('tag', [])
        )
        
        db.session.add(note)
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': '创建笔记成功',
            'data': {
                'nid': nid
            }
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"创建笔记错误: {str(e)}")
        return jsonify({
            'code': 1,
            'msg': f'创建笔记失败: {str(e)}'
        }), 500

# 更新笔记
@note_bp.route('/api/note/update', methods=['POST'])
def update_note():
    # 从会话或请求数据中获取用户ID
    uid = session.get('uid') or request.json.get('uid')
    data = request.json
    
    try:
        nid = data.get('nid')
        if not nid:
            return jsonify({
                'code': 1,
                'msg': '笔记ID不能为空'
            }), 400
        
        # 如果提供了uid，则检查权限
        if uid:
            note = Note.query.filter_by(nid=nid, uid=uid).first()
        else:
            # 简化起见，如果没有uid，直接通过nid获取笔记
            note = Note.query.filter_by(nid=nid).first()
        
        if not note:
            return jsonify({
                'code': 1,
                'msg': '笔记不存在'
            }), 404
        
        # 更新笔记信息
        note.title = data.get('title', note.title)
        note.abstract = data.get('abstract', note.abstract)
        note.content = data.get('content', note.content)
        note.state = data.get('state', note.state)
        note.top = data.get('top', note.top)
        note.collection = data.get('collection', note.collection)
        note.tag = data.get('tag', note.tag)
        note.update = datetime.datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': '更新笔记成功',
            'data': note.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"更新笔记错误: {str(e)}")
        return jsonify({
            'code': 1,
            'msg': f'更新笔记失败: {str(e)}'
        }), 500

# 删除笔记
@note_bp.route('/api/note/delete/<nid>', methods=['DELETE'])
def delete_note(nid):
    # 从会话或请求参数中获取用户ID
    uid = session.get('uid') or request.args.get('uid')
    
    try:
        # 如果提供了uid，则检查权限
        if uid:
            note = Note.query.filter_by(nid=nid, uid=uid).first()
        else:
            # 简化起见，如果没有uid，直接通过nid获取笔记
            note = Note.query.filter_by(nid=nid).first()
        
        if not note:
            return jsonify({
                'code': 1,
                'msg': '笔记不存在'
            }), 404
        
        db.session.delete(note)
        db.session.commit()
        
        return jsonify({
            'code': 0,
            'msg': '删除笔记成功'
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"删除笔记错误: {str(e)}")
        return jsonify({
            'code': 1,
            'msg': f'删除笔记失败: {str(e)}'
        }), 500

# 导入Markdown文件
@note_bp.route('/api/note/import', methods=['POST'])
def import_markdown():
    # 从会话或表单数据中获取用户ID
    uid = session.get('uid') or request.form.get('uid')
    
    # 如果没有uid，使用测试用户ID
    uid = uid or 'test-user'
    
    if 'file' not in request.files:
        return jsonify({
            'code': 1,
            'msg': '未找到文件'
        }), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({
            'code': 1,
            'msg': '未选择文件'
        }), 400
    
    if file and file.filename.endswith('.md'):
        try:
            # 读取文件内容
            content = file.read().decode('utf-8')
            
            # 从文件名中提取标题
            title = os.path.splitext(secure_filename(file.filename))[0]
            
            # 提取摘要 (前100个字符)
            abstract = re.sub(r'#|`|_|\*|\[|\]|\(|\)|!|>', '', content[:100]).strip()
            
            # 生成唯一ID
            nid = str(uuid.uuid4())
            
            # 创建新笔记
            note = Note(
                nid=nid,
                uid=uid,
                title=title,
                abstract=abstract,
                content=content,
                state='completed',  # 导入的文件默认为已完成状态
                top=0,
                collection=0,
                tag=['导入']
            )
            
            db.session.add(note)
            db.session.commit()
            
            return jsonify({
                'code': 0,
                'msg': '导入Markdown成功',
                'data': {
                    'nid': nid
                }
            })
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"导入Markdown错误: {str(e)}")
            return jsonify({
                'code': 1,
                'msg': f'导入Markdown失败: {str(e)}'
            }), 500
    
    return jsonify({
        'code': 1,
        'msg': '不支持的文件类型'
    }), 400