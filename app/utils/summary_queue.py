import uuid
import time
import requests
import json
import threading
import queue
import logging
from ..model import db, Summary, StudyRecord

# 创建独立的日志记录器
logger = logging.getLogger('summary_queue')
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)

# 创建任务队列
task_queue = queue.Queue()
# 保存任务状态的字典
task_status = {}
# 停止标志
stop_worker = False
# 存储Flask应用实例
flask_app = None

def init_app(app):
    """初始化队列处理器并保存Flask应用实例"""
    global flask_app
    flask_app = app
    # 启动工作线程
    worker_thread = threading.Thread(target=queue_worker, daemon=True)
    worker_thread.start()
    logger.info("总结队列处理器已初始化")
    return worker_thread

def queue_worker():
    """队列工作线程，处理队列中的任务"""
    logger.info("总结队列工作线程已启动")
    
    while not stop_worker:
        try:
            # 获取任务，设置超时以便能够响应停止信号
            task_id = task_queue.get(timeout=5)
            logger.info(f"从队列获取任务: {task_id}")
            
            # 处理任务
            process_summary_task(task_id)
            
            # 标记任务完成
            task_queue.task_done()
            
        except queue.Empty:
            # 队列为空，继续等待
            continue
        except Exception as e:
            logger.error(f"队列工作线程出错: {str(e)}", exc_info=True)
            # 继续工作，不让一个任务的错误影响整个队列

def add_to_summary_queue(record_data):
    """
    添加任务到总结生成队列
    
    Args:
        record_data: 包含学习记录信息的字典，包括 rid, uid, title, record 和可选的 tags
    
    Returns:
        str: 任务ID
    """
    # 生成任务ID
    task_id = str(uuid.uuid4())
    
    # 添加日志记录收到的标签数据
    tags = record_data.get('tags', [])
    logger.info(f"收到标签数据用于任务 {task_id}: {tags}, 类型: {type(tags)}")
    
    # 存储任务信息
    task_status[task_id] = {
        'status': 'pending',
        'created_at': time.time(),
        'record_data': record_data
    }
    
    # 添加到队列
    task_queue.put(task_id)
    
    # 记录日志
    logger.info(f"添加总结任务到队列: {task_id}, 记录ID: {record_data.get('rid')}")
    
    return task_id

def process_summary_task(task_id):
    """
    处理总结生成任务
    
    Args:
        task_id: 任务ID
    """
    if task_id not in task_status:
        logger.warning(f"任务ID不存在: {task_id}")
        return
    
    logger.info(f"开始处理总结任务: {task_id}")
    
    task_info = task_status[task_id]
    record_data = task_info['record_data']
    rid = record_data.get('rid')
    uid = record_data.get('uid')
    tags = record_data.get('tags', [])
    record_content = record_data.get('record')
    
    # 添加详细的标签数据日志
    logger.info(f"任务 {task_id} 中的标签数据: {tags}, 类型: {type(tags)}")
    if isinstance(tags, list):
        logger.info(f"标签列表长度: {len(tags)}, 内容: {tags}")
        for i, tag in enumerate(tags):
            logger.info(f"标签[{i}]: '{tag}', 类型: {type(tag)}")
    
    try:
        # 更新任务状态
        task_status[task_id]['status'] = 'processing'
        
        # 如果没有直接传递记录内容，则从数据库获取
        if not record_content and flask_app:
            with flask_app.app_context():
                record = StudyRecord.query.filter_by(rid=rid).first()
                if not record:
                    task_status[task_id]['status'] = 'failed'
                    task_status[task_id]['error'] = '找不到对应的学习记录'
                    return
                record_content = record.record
        
        if not record_content:
            task_status[task_id]['status'] = 'failed'
            task_status[task_id]['error'] = '无法获取学习记录内容'
            return
        
        # 生成摘要
        logger.info(f"生成摘要中: {task_id}")
        summary_content = generate_summary(record_content, tags)
        
        # 保存摘要到数据库
        sid = str(uuid.uuid4())
        
        # 确保标签按正确格式存储
        logger.info(f"开始处理标签格式，原始标签: {tags}")
        if isinstance(tags, list) and tags:
            # 过滤掉空标签并去重
            filtered_tags = [tag.strip() for tag in tags if tag and tag.strip()]
            logger.info(f"过滤后的标签: {filtered_tags}")
            unique_tags = list(set(filtered_tags))
            logger.info(f"去重后的标签: {unique_tags}")
            tag_str = ", ".join(unique_tags)
        else:
            logger.warning(f"标签数据无效或为空: {tags}")
            tag_str = ""
        
        logger.info(f"最终标签字符串: '{tag_str}'")
        
        if flask_app:
            with flask_app.app_context():
                # 记录创建Summary对象前的日志
                logger.info(f"创建Summary对象: sid={sid}, uid={uid}, tag='{tag_str}'")
                new_summary = Summary(sid=sid, uid=uid, tag=tag_str, summary=summary_content)
                
                # 尝试添加rid字段，如果Summary模型支持的话
                try:
                    new_summary.rid = rid
                    logger.info(f"成功添加rid: {rid}")
                except Exception as e:
                    logger.warning(f"添加rid字段失败，可能Summary模型不支持: {str(e)}")
                
                db.session.add(new_summary)
                db.session.commit()
                logger.info(f"Summary对象已保存到数据库")
        
                # 更新任务状态
                task_status[task_id]['status'] = 'completed'
                task_status[task_id]['summary_id'] = sid
                logger.info(f"总结任务完成: {task_id}, 总结ID: {sid}, 标签: {tag_str}")
        else:
            task_status[task_id]['status'] = 'failed'
            task_status[task_id]['error'] = 'Flask应用上下文不可用'
            logger.error("Flask应用上下文不可用，无法保存摘要")
        
        # 清理过期的任务信息
        clean_old_tasks()
        
    except Exception as e:
        logger.error(f"生成摘要失败: {str(e)}", exc_info=True)
        task_status[task_id]['status'] = 'failed'
        task_status[task_id]['error'] = str(e)
        if flask_app:
            with flask_app.app_context():
                db.session.rollback()

def generate_summary(content, tags=None):
    """
    调用AI生成总结
    
    Args:
        content: 要总结的内容
        tags: 相关标签
    
    Returns:
        string: 生成的总结内容
    """
    # 构建提示词
    tag_text = f"相关主题: {', '.join(tags)}" if tags else ""
    prompt = f"""请对以下Python学习内容生成用户下次学习相关内容的学习建议。{tag_text}
建议需要包含：
1. 用户已经学会什么
2. 用户存在的薄弱点<如果没有进行问答责忽略>
3. 下一次用户学习相关的内容时候的学习建议和理由（你的任务是给出下一步的学习建议，请不要生成关于实践的建议，例如：你不用建议用户去编写任何代码）。

学习内容：
{content}
"""
    
    # 调用AI接口
    headers = {
        'Authorization': 'Bearer sk-b8820bde77e34e119b76d3a7937c3fad',
        'Content-Type': 'application/json'
    }
    
    ai_data = {
        "model": "qwen-plus",
        "messages": [
            {"role": "system", "content": "你是一个专业的Python学习内容总结助手，善于分析学习内容并提供有针对性的学习建议"},
            {"role": "user", "content": prompt}
        ],
    }
    
    try:
        logger.info("调用AI接口生成总结")
        response = requests.post(
            'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
            headers=headers, json=ai_data
        )
        response.raise_for_status()
        result = response.json()
        
        return result['choices'][0]['message']['content']
    except requests.exceptions.RequestException as e:
        logger.error(f"调用AI接口生成总结失败: {str(e)}")
        return f"生成总结失败: {str(e)}"

def get_task_status(task_id):
    """
    获取任务状态
    
    Args:
        task_id: 任务ID
    
    Returns:
        dict: 任务状态信息
    """
    if task_id not in task_status:
        return {'status': 'not_found'}
    
    task_info = task_status[task_id].copy()
    
    # 如果任务完成，返回摘要ID
    if task_info['status'] == 'completed' and 'summary_id' in task_info and flask_app:
        try:
            with flask_app.app_context():
                # 查询摘要内容
                summary = Summary.query.filter_by(sid=task_info['summary_id']).first()
                if summary:
                    task_info['summary'] = summary.to_dict()
        except Exception as e:
            logger.error(f"获取摘要信息失败: {str(e)}")
    
    return task_info

def clean_old_tasks():
    """清理超过30分钟的任务状态信息"""
    current_time = time.time()
    expired_tasks = [tid for tid, data in task_status.items() 
                    if current_time - data['created_at'] > 1800]
    
    for tid in expired_tasks:
        logger.info(f"清理过期任务: {tid}")
        task_status.pop(tid, None)

def shutdown():
    """关闭队列工作线程"""
    global stop_worker
    stop_worker = True
    logger.info("正在关闭总结队列处理器...")