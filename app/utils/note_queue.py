import queue
import threading
import time
import logging
import json
import uuid
from datetime import datetime
from ..model import db, Note
import requests
from requests.exceptions import RequestException
from flask import current_app
# 创建笔记处理队列
note_queue = queue.Queue()
queue_running = False

def add_to_note_queue(record_data):
    """
    添加记录到笔记生成队列
    
    Args:
        record_data: 包含记录信息的字典，需要包含 rid, uid, title, record 字段
    """
    note_queue.put(record_data)
    start_queue_worker()

def start_queue_worker():
    """启动队列处理线程（如果未运行）"""
    global queue_running
    
    if not queue_running:
        queue_running = True
        thread = threading.Thread(target=process_note_queue)
        thread.daemon = True  # 设置为守护线程，不阻止程序退出
        thread.start()
        logging.info("笔记生成队列处理线程已启动")

def process_note_queue():
    global queue_running
    from app import create_app
    app = create_app()
    try:
        with app.app_context():
            while True:
                try:
                    record_data = note_queue.get(timeout=2)
                    try:
                        process_note_generation(record_data)
                    except Exception as e:
                        logging.error(f"处理笔记生成任务失败: {str(e)}")
                    note_queue.task_done()
                except queue.Empty:
                    if note_queue.empty():
                        break
    finally:
        queue_running = False
        logging.info("笔记生成队列处理线程已结束")

def process_note_generation(record_data):
    """
    处理笔记生成任务
    
    Args:
        record_data: 包含记录信息的字典
    """
    logging.info(f"开始处理笔记生成任务: {record_data['rid']}")
    
    try:
        # 解析记录内容
        record_content = json.loads(record_data['record'])
        
        # 准备AI请求数据
        learning_content = record_content.get('learning', [])
        qa_content = record_content.get('qa', [])
        
        # 合并内容进行处理
        all_content = []
        
        # 处理学习内容
        for item in learning_content:
            if item.get('type') == 'ai':
                all_content.append({"role": "assistant", "content": item.get('content', '')})
            elif item.get('type') == 'user':
                all_content.append({"role": "user", "content": item.get('content', '')})
                
        # 处理问答内容
        for item in qa_content:
            if item.get('type') == 'ai':
                all_content.append({"role": "assistant", "content": item.get('content', '')})
            elif item.get('type') == 'user':
                all_content.append({"role": "user", "content": item.get('content', '')})
        
        # 构建系统提示词
        system_prompt = """你是一个笔记生成专家。请根据提供的学习对话记录，生成一篇结构化的笔记。
要求：
1. 提取主要知识点和关键概念
2. 使用Markdown格式组织内容，包含标题、子标题、列表等
3. 代码示例使用代码块格式
4. 返回JSON格式，包含以下字段:
   - title: 笔记标题(字符串)
   - content: 笔记内容(字符串，使用Markdown格式)
5. 内容应该精炼但完整
6. 不要在字段中使用嵌套的JSON结构，保持为纯文本格式
7. 不要包含原始对话中的问候和闲聊内容"""

        # 调用AI接口生成笔记
        headers = {
            'Authorization': 'Bearer sk-62cbf150996e40d9b1ec3ab39c831904',
            'Content-Type': 'application/json'
        }
        
        # 构造请求消息
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # 添加提示以处理会话记录
        intro_message = f"以下是一次关于'{record_data['title']}'的学习记录，请据此生成笔记，只要json，不要输出任何无关内容。"
        messages.append({"role": "user", "content": intro_message})
        
        # 添加完整的会话内容
        conversation_summary = ""
        for msg in all_content:  # 处理全部消息，不进行截断
            role = "用户" if msg["role"] == "user" else "助手"
            conversation_summary += f"\n\n{role}:\n{msg['content']}"
        
        messages.append({"role": "user", "content": conversation_summary})
        messages.append({"role": "user", "content": "请生成符合要求的JSON格式笔记，确保title和content字段都是纯文本格式。"})
        
        # 构造AI请求数据
        ai_data = {
            "model": "deepseek-chat",
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
            "max_tokens": 4000  # 确保有足够的输出空间
        }
        
        try:
            response = requests.post(
                'https://api.deepseek.com/chat/completions',
                headers=headers, 
                json=ai_data
            )
            response.raise_for_status()
            result = response.json()
            
            # 解析AI生成的内容
            ai_content = result['choices'][0]['message']['content']
            logging.error(f"AI原始返回内容: {ai_content}")
            note_data = json.loads(ai_content)
            
            # 提取生成的笔记标题和内容
            note_title = note_data.get('title', record_data['title'])
            note_content = note_data.get('content', '')
            note_content = clean_note_content(note_content)
            # 从笔记内容的前200个字符生成摘要
            if len(note_content) > 200:
                note_abstract = note_content[:200] + "..."
            else:
                note_abstract = note_content
                
            # 去掉Markdown标记以创建更干净的摘要
            note_abstract = note_abstract.replace('#', '').replace('*', '').replace('```', '')
            
            # 生成笔记ID
            nid = str(uuid.uuid4())
            
            # 从原始标题中提取标签
            tags = ["自动生成"]
            if ',' in record_data['title']:
                tags.extend([tag.strip() for tag in record_data['title'].split(',')])
            
            # 创建笔记
            note = Note(
                nid=nid,
                uid=record_data['uid'],
                title=note_title,
                abstract=note_abstract,
                content=note_content,
                state='active',
                top=0,
                collection=0,
                tag=tags
            )
            
            # 添加到数据库
            db.session.add(note)
            db.session.commit()
            
            logging.info(f"成功从记录 {record_data['rid']} 创建笔记 {nid}")
            
        except (RequestException, json.JSONDecodeError) as e:
            logging.error(f"AI请求或解析失败: {str(e)}")
            
            # 失败后使用默认方式创建笔记
            nid = str(uuid.uuid4())
            
            # 从学习记录中获取最后一个AI消息作为内容
            default_content = ""
            if learning_content:
                for item in reversed(learning_content):
                    if item.get('type') == 'ai' and item.get('content'):
                        default_content = item.get('content')
                        break
            
            # 如果学习内容没有AI消息，尝试从问答内容获取
            if not default_content and qa_content:
                for item in reversed(qa_content):
                    if item.get('type') == 'ai' and item.get('content'):
                        default_content = item.get('content')
                        break
            
            # 如果还是没有内容，则使用原始记录
            if not default_content:
                default_content = json.dumps(record_content, ensure_ascii=False)
            
            note = Note(
                nid=nid,
                uid=record_data['uid'],
                title=record_data['title'],
                abstract=f"基于学习记录自动生成的笔记",
                content=default_content,
                state='active',
                top=0,
                collection=0,
                tag=["自动生成"]
            )
            
            db.session.add(note)
            db.session.commit()
            logging.info(f"使用默认方式从记录 {record_data['rid']} 创建笔记 {nid}")
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"笔记生成失败: {str(e)}")
        raise


def clean_note_content(raw_content: str) -> str:
    import re
    # 1. 还原所有 \n 和 \\n 为真正的换行
    content = raw_content.replace('\\n', '\n').replace('\\\\n', '\n')
    # 3. 还原所有 python\\\n 或 python\n 为 markdown 代码块
    content = re.sub(r'python\\*\\*?\n', '```python\n', content)
    # 4. 用正则把每个以```python开头，遇到空行或结尾的代码段补上```
    def close_code_block(match):
        code = match.group(1)
        return f'```python\n{code}\n```'
    content = re.sub(r'```python\n(.*?)(?=\n\n|\Z)', close_code_block, content, flags=re.DOTALL)
    # 5. 去除多余空行
    content = re.sub(r'\n{3,}', '\n\n', content)
    # 6. 去除多余的反斜杠
    content = content.replace('\\\\', '')
    return content.strip()