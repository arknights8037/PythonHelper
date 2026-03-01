from flask import Blueprint, request, jsonify, session
import uuid
from ..model import db, StudyRecord, Summary
import logging
import json
from datetime import datetime
from ..utils.note_queue import add_to_note_queue
from ..utils.summary_queue import add_to_summary_queue, get_task_status

study_bp = Blueprint('study', __name__, url_prefix='/api/study')

@study_bp.route('/save_record', methods=['POST'])
def save_record():
    try:
        current_user = session.get('uid')
        if not current_user:
            return jsonify({"code": 401, "message": "未登录，无法保存记录"}), 401
        
        data = request.json
        if not data:
            return jsonify({"code": 400, "message": "请求数据格式错误"}), 400
            
        title = data.get('title', '未命名记录')
        record = data.get('record')
        auto_generate_note = data.get('autoGenerateNote', False)
        auto_generate_summary = data.get('autoGenerateSummary', False)
        tags = data.get('tags', [])
        
        # 添加标签数据的详细日志
        logging.debug(f"接收到保存记录请求：用户={current_user}, 标题={title}")
        logging.info(f"标签数据: {tags}, 类型: {type(tags)}, 长度: {len(tags) if isinstance(tags, list) else '非列表'}")
        
        if not record:
            return jsonify({"code": 400, "message": "记录内容不能为空"}), 400
        rid = str(uuid.uuid4())
        study_record = StudyRecord(
            rid=rid,
            uid=current_user,
            title=title,
            record=record
        )
        db.session.add(study_record)
        db.session.commit()
        response_data = {"rid": rid}
        
        # 如果选择了自动生成笔记，将任务添加到笔记队列
        if auto_generate_note:
            add_to_note_queue({
                'rid': rid,
                'uid': current_user,
                'title': title,
                'record': record
            })
        
        # 添加日志记录将要发送给队列的标签数据
        logging.info(f"发送到总结队列的标签数据: {tags}")
        task_id = add_to_summary_queue({
            'rid': rid,
            'uid': current_user,
            'title': title,
            'record': record,
            'tags': tags
        })
        response_data['summaryTaskId'] = task_id
        
        return jsonify({
            "code": 200,
            "message": "记录保存成功，总结正在生成中",
            "data": response_data
        })
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"保存学习记录失败: {str(e)}")
        return jsonify({"code": 500, "message": f"服务器错误: {str(e)}"}), 500

@study_bp.route('/summary-status', methods=['GET'])
def summary_status():
    try:
        task_id = request.args.get('taskId')
        
        if not task_id:
            return jsonify({"code": 400, "message": "缺少任务ID参数"}), 400
        
        status = get_task_status(task_id)
        
        return jsonify({
            "code": 200,
            "message": "查询成功",
            "data": status
        })
        
    except Exception as e:
        logging.error(f"查询总结任务状态失败: {str(e)}")
        return jsonify({"code": 500, "message": f"服务器错误: {str(e)}"}), 500

@study_bp.route('/summaries', methods=['GET'])
def get_user_summaries():
    try:
        # 从 session 中获取当前用户 ID
        current_user = session.get('uid')
        
        # 如果用户未登录，返回错误
        if not current_user:
            return jsonify({"code": 401, "message": "未登录，无法获取摘要"}), 401
        
        # 获取用户的所有摘要，按创建时间降序排序
        summaries = Summary.query.filter_by(uid=current_user).order_by(Summary.create_time.desc()).all()
        
        # 将结果转换为字典列表
        result = [summary.to_dict() for summary in summaries]
        
        return jsonify({
            "code": 200,
            "message": "获取摘要成功",
            "data": result
        })
        
    except Exception as e:
        logging.error(f"获取用户摘要失败: {str(e)}")
        return jsonify({"code": 500, "message": f"服务器错误: {str(e)}"}), 500