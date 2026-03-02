from flask import Blueprint, request, jsonify, Response, session
from flask_cors import cross_origin
import requests
import json
import uuid
import time
from ..model import db, Summary

learn_bp = Blueprint('learn', __name__)

# 存储会话数据
sessions = {}

@learn_bp.route('/init-session', methods=['POST'])
@cross_origin()
def init_session():
    tags = request.json.get('tags', [])
    
    if not tags:
        return jsonify({'success': False, 'message': '未选择知识点'})
    
    # 生成会话ID并存储数据
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        'tags': tags,
        'created_at': time.time(),
        'prompt': '',  # 用于存储提示词
        'learning_messages': [],  # 存储学习消息历史
        'qa_messages': []  # 存储问答消息历史
    }
    
    # 清理旧会话
    clean_old_sessions()
    
    return jsonify({
        'success': True,
        'sessionId': session_id
    })

@learn_bp.route('/stream-learn', methods=['GET'])
@cross_origin()
def stream_learn_get():
    session_id = request.args.get('session')
    
    if not session_id or session_id not in sessions:
        return jsonify({
            'success': False, 
            'message': '无效的会话ID'
        }), 400
    
    # 获取会话数据
    session_data = sessions[session_id]
    tags = session_data['tags']
    
    # 生成学习提示词
    prompt = prompt_startlearn(tags)
    print(f"[DEBUG] Generated learning prompt: {prompt}")
    
    # 保存提示词到会话
    session_data['prompt'] = prompt

    def generate():
        # 先发送提示词到前端
        prompt_data = json.dumps({
            'type': 'prompt',
            'content': prompt
        })
        yield f"data: {prompt_data}\n\n"
        
        # 发送开始信号
        yield "data: {\"type\": \"start\"}\n\n"
        
        # 启用流式传输
        headers = {
            'Authorization': 'Bearer sk-b8820bde77e34e119b76d3a7937c3fad',
            'Content-Type': 'application/json'
        }
        ai_data = {
            "model": "qwen-plus",
            "messages": [
                {"role":"system","content":"你是一个Python学习平台的学习助手,善于为不同需求的人群讲解python知识。你会收到一份教学大纲，按照内容进行讲解"},
                {"role": "user", "content": prompt}
            ],
            "stream": True
        }

        ai_response_content = ""  # 用于累积AI回复内容
        
        # 调用AI接口并处理流式响应
        try:
            with requests.post(
                'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
                headers=headers, json=ai_data, stream=True
            ) as r:
                r.raise_for_status()
                
                for line in r.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        
                        # 处理数据格式
                        if decoded_line.startswith('data:'):
                            decoded_line = decoded_line[5:].strip()
                        
                        try:
                            # 解析JSON
                            json_data = json.loads(decoded_line)
                            
                            # 提取内容并传递给前端
                            if ('choices' in json_data and json_data['choices'] and 
                                'delta' in json_data['choices'][0] and 
                                'content' in json_data['choices'][0]['delta']):
                                
                                content = json_data['choices'][0]['delta']['content']
                                if content:
                                    ai_response_content += content  # 累积内容
                                    sse_data = json.dumps({
                                        'content': content,
                                        'type': 'content'
                                    })
                                    yield f"data: {sse_data}\n\n"
                            
                            # 检查是否结束
                            if ('choices' in json_data and json_data['choices'] and 
                                'finish_reason' in json_data['choices'][0] and 
                                json_data['choices'][0]['finish_reason'] in ['DONE', '[DONE]', 'stop']):
                                
                                # 保存AI回复到学习历史
                                if ai_response_content:
                                    session_data['learning_messages'].append({
                                        "role": "assistant", 
                                        "content": ai_response_content
                                    })
                                
                                yield "data: {\"type\": \"end\"}\n\n"
                        
                        except json.JSONDecodeError as e:
                            # 处理特殊结束标记
                            if decoded_line.strip() in ['[DONE]', 'data: [DONE]']:
                                yield "data: {\"type\": \"end\"}\n\n"
                            else:
                                # 发送原始数据
                                sse_data = json.dumps({
                                    'content': decoded_line,
                                    'type': 'raw'
                                })
                                yield f"data: {sse_data}\n\n"
                            
        except Exception as e:
            error_message = f"处理请求失败: {str(e)}"
            sse_data = json.dumps({
                'content': error_message,
                'type': 'error'
            })
            yield f"data: {sse_data}\n\n"

    # 返回SSE流
    return Response(generate(), mimetype='text/event-stream')

@learn_bp.route('/stream-qa', methods=['GET'])
@cross_origin()
def stream_qa():
    session_id = request.args.get('session')
    question = request.args.get('question', '')
    
    if not session_id or session_id not in sessions:
        return jsonify({
            'success': False, 
            'message': '无效的会话ID'
        }), 400
    
    # 获取会话数据
    session_data = sessions[session_id]
    tags = session_data['tags']
    prompt = session_data.get('prompt', '')
    
    # 如果是开始问答，记录用户请求
    if not question or question == "开始问答":
        user_message = "请基于学习内容生成问题测试我的掌握情况"
        session_data['qa_messages'] = []  # 重置问答历史
        
        # 添加系统消息到问答历史中
        system_message = f"你是一个Python学习平台的学习助手,善于为不同需求的人群讲解python知识。主题是关于: {', '.join(tags)}。"
        if prompt:
            system_message += f"\n以下是学习内容的大纲：\n{prompt}\n"
            system_message += "请基于此大纲生成问题。生成问题的要求是：1、每次只生成一个问题，等待用户回答后判题并且生成下一个问题。2、问题从记忆(2个，考察用户对基本语法或者方法的记忆)、理解(2个，考察用户对语法功能逻辑的理解)、分析评价(1个，考察用户对代码的组织和运行机制的分析能力)、应用(1个，考察代码能力)、综合(1个，考察对知识点的掌握程度)这个5个维度进行生成。3、生成的问题不要附带答案。"
        
        # 将系统消息添加到问答历史
        session_data['qa_messages'].append({
            "role": "system", 
            "content": system_message
        })
        
        # 将用户请求添加到问答历史
        session_data['qa_messages'].append({
            "role": "user",
            "content": user_message
        })
    else:
        # 将用户问题添加到问答历史
        user_message = question
        session_data['qa_messages'].append({
            "role": "user", 
            "content": question
        })
    
    def generate():
        # 发送开始信号
        yield "data: {\"type\": \"start\"}\n\n"
        
        # 构建消息数组，避免无限增长，保留系统消息和最近8条对话
        if len(session_data['qa_messages']) > 9:
            system_msg = session_data['qa_messages'][0]
            recent_msgs = session_data['qa_messages'][-8:]
            messages = [system_msg] + recent_msgs
        else:
            messages = session_data['qa_messages'].copy()
        
        # 调用AI接口
        headers = {
            'Authorization': 'Bearer sk-b8820bde77e34e119b76d3a7937c3fad',
            'Content-Type': 'application/json'
        }
        ai_data = {
            "model": "qwen-plus",
            "messages": messages,
            "stream": True
        }
        
        ai_response_content = ""  # 累积回复内容
        
        try:
            with requests.post(
                'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
                headers=headers, json=ai_data, stream=True
            ) as r:
                r.raise_for_status()
                
                for line in r.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        
                        # 处理数据格式
                        if decoded_line.startswith('data:'):
                            decoded_line = decoded_line[5:].strip()
                        
                        try:
                            json_data = json.loads(decoded_line)
                            
                            # 提取内容
                            if ('choices' in json_data and json_data['choices'] and 
                                'delta' in json_data['choices'][0] and 
                                'content' in json_data['choices'][0]['delta']):
                                
                                content = json_data['choices'][0]['delta']['content']
                                if content:
                                    ai_response_content += content
                                    sse_data = json.dumps({
                                        'content': content,
                                        'type': 'content'
                                    })
                                    yield f"data: {sse_data}\n\n"
                            
                            # 检查结束
                            if ('choices' in json_data and json_data['choices'] and 
                                'finish_reason' in json_data['choices'][0] and 
                                json_data['choices'][0]['finish_reason'] in ['DONE', '[DONE]', 'stop']):
                                
                                # 保存AI回复到问答历史
                                if ai_response_content:
                                    session_data['qa_messages'].append({
                                        "role": "assistant", 
                                        "content": ai_response_content
                                    })
                                
                                yield "data: {\"type\": \"end\"}\n\n"
                        
                        except json.JSONDecodeError as e:
                            # 处理特殊结束标记
                            if decoded_line.strip() in ['[DONE]', 'data: [DONE]']:
                                yield "data: {\"type\": \"end\"}\n\n"
                            else:
                                # 发送原始数据
                                sse_data = json.dumps({
                                    'content': decoded_line,
                                    'type': 'raw'
                                })
                                yield f"data: {sse_data}\n\n"
                    
        except Exception as e:
            error_message = f"处理请求失败: {str(e)}"
            sse_data = json.dumps({
                'content': error_message,
                'type': 'error'
            })
            yield f"data: {sse_data}\n\n"

    # 返回SSE流
    return Response(generate(), mimetype='text/event-stream')

@learn_bp.route('/stream-chat', methods=['POST'])
@cross_origin()
def stream_chat():
    session_id = request.json.get('sessionId')
    question = request.json.get('question')
    # 前端传来的历史记录用于上下文，但后端仍维护完整历史
    
    if not session_id or session_id not in sessions:
        return jsonify({
            'success': False, 
            'message': '无效的会话ID'
        }), 400
    
    # 获取会话数据
    session_data = sessions[session_id]
    tags = session_data['tags']
    
    # 将用户问题添加到学习历史
    session_data['learning_messages'].append({
        "role": "user", 
        "content": question
    })
    
    def generate():
        # 发送开始信号
        yield "data: {\"type\": \"start\"}\n\n"
        
        # 构建系统提示词
        system_message = f"你是一个Python学习平台的学习助手,善于为不同需求的人群讲解python知识。主题是关于: {', '.join(tags)}。请简洁清晰地回答用户问题。"
        
        # 这里为了避免无限增加完整历史导致token超限，我们对学习历史进行截断(保留最近10条)
        recent_history = session_data['learning_messages'][-10:] if len(session_data['learning_messages']) > 10 else session_data['learning_messages']
        
        # 构建最终消息数组
        messages = [{"role": "system", "content": system_message}] + recent_history
        
        # 调用AI接口
        headers = {
            'Authorization': 'Bearer sk-b8820bde77e34e119b76d3a7937c3fad',
            'Content-Type': 'application/json'
        }
        ai_data = {
            "model": "qwen-plus",
            "messages": messages,
            "stream": True
        }
        
        ai_response_content = ""  # 累积回复内容
        
        try:
            with requests.post(
                'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
                headers=headers, json=ai_data, stream=True
            ) as r:
                r.raise_for_status()
                
                for line in r.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        
                        # 处理数据格式
                        if decoded_line.startswith('data:'):
                            decoded_line = decoded_line[5:].strip()
                        
                        try:
                            json_data = json.loads(decoded_line)
                            
                            # 提取内容
                            if ('choices' in json_data and json_data['choices'] and 
                                'delta' in json_data['choices'][0] and 
                                'content' in json_data['choices'][0]['delta']):
                                
                                content = json_data['choices'][0]['delta']['content']
                                if content:
                                    ai_response_content += content
                                    sse_data = json.dumps({
                                        'content': content,
                                        'type': 'content'
                                    })
                                    yield f"data: {sse_data}\n\n"
                            
                            # 检查结束
                            if ('choices' in json_data and json_data['choices'] and 
                                'finish_reason' in json_data['choices'][0] and 
                                json_data['choices'][0]['finish_reason'] in ['DONE', '[DONE]', 'stop']):
                                
                                # 保存AI回复到学习历史
                                if ai_response_content:
                                    session_data['learning_messages'].append({
                                        "role": "assistant", 
                                        "content": ai_response_content
                                    })
                                
                                yield "data: {\"type\": \"end\"}\n\n"
                        
                        except json.JSONDecodeError as e:
                            # 处理特殊结束标记
                            if decoded_line.strip() in ['[DONE]', 'data: [DONE]']:
                                yield "data: {\"type\": \"end\"}\n\n"
                            else:
                                # 发送原始数据
                                sse_data = json.dumps({
                                    'content': decoded_line,
                                    'type': 'raw'
                                })
                                yield f"data: {sse_data}\n\n"
                    
        except Exception as e:
            error_message = f"处理请求失败: {str(e)}"
            sse_data = json.dumps({
                'content': error_message,
                'type': 'error'
            })
            yield f"data: {sse_data}\n\n"

    # 返回SSE流
    return Response(generate(), mimetype='text/event-stream')

def prompt_startlearn(tags):
    """生成学习提示词，并关联用户历史学习记录"""
    print(f"[DEBUG] Generating prompt for tags: {tags}")
    
    # 获取当前用户ID
    current_user = session.get('uid')
    previous_summary = None
    
    # 如果用户已登录，查找相关的历史总结
    if current_user:
        try:
            # 构建查询条件：标签部分匹配
            query_conditions = []
            for tag in tags:
                query_conditions.append(Summary.tag.like(f"%{tag}%"))
            
            # 查询最近的相关总结
            matching_summary = Summary.query.filter(
                Summary.uid == current_user,
                db.or_(*query_conditions)  # 使用or连接所有标签条件
            ).order_by(Summary.create_time.desc()).first()
            
            if matching_summary:
                previous_summary = matching_summary.summary
                print(f"[DEBUG] Found related summary: {matching_summary.sid}")
        except Exception as e:
            print(f"[DEBUG] Error retrieving previous summaries: {str(e)}")
    
    # 添加历史总结到提示词中
    additional_context = ""
    if previous_summary:
        additional_context = f"。用户学习过相关内容，下面是相关的总结和建议：\n{previous_summary}\n请基于此为用户提供进阶内容，避免重复基础知识。"
    print("[DEBUG] 检索到相关记录: ", additional_context)
    # 调用AI生成提示词
    headers = {
        'Authorization': 'Bearer sk-12ecefa1b46f4b67ac446fa4baed7e7f',
        'Content-Type': 'application/json'
    }
    ai_data = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "你是一个提示词生成助手，直接生成提示词内容，不要回复任何其他内容。现在你的任务是生成提示词交给下一个大模型。"},
            {"role": "user", "content": f"编程语言：python。知识点: {', '.join(tags)}，你需要生成介绍这个（些）知识点需要覆盖的内容大纲，{additional_context}。如果用户第一次学习不介绍数据结构和高级特性，不生成练习。"}
        ],
        "temperature": 0,
    }

    try:
        response = requests.post(
            'https://api.deepseek.com/chat/completions', 
            headers=headers, json=ai_data
        )
        response.raise_for_status()
        result = response.json()
        return result['choices'][0]['message']['content']
    except requests.exceptions.RequestException as e:
        error_message = f"生成提示词失败: {str(e)}"
        print(f"[DEBUG] Error: {error_message}")
        return error_message

def clean_old_sessions():
    """清理超过2小时的旧会话"""
    current_time = time.time()
    expired_sessions = [sid for sid, data in sessions.items() 
                       if current_time - data['created_at'] > 7200]
    
    for sid in expired_sessions:
        sessions.pop(sid, None)

