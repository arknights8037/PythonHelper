from flask import Blueprint, jsonify, request, current_app, session
from datetime import datetime, timedelta
from ..model import db, Topics, UserInfo, Favorites, StudyRecord
import uuid
from sqlalchemy import desc, asc, case
from ..utils.auth import login_required  

# 创建蓝图
homepage_bp = Blueprint('homepage', __name__, url_prefix='/homepage')

@homepage_bp.route('/posts')
def get_posts():
    """获取帖子列表，支持分页、模式筛选和搜索"""
    try:
        # 获取请求参数
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 15))
        mode = request.args.get('mode', 'all')  # all, mine, custom
        search = request.args.get('search', '')
        filter_option = request.args.get('filter', 'latest')  # latest, popular
        
        # 构建查询
        query = Topics.query
        
        # 根据模式筛选
        if mode == 'mine':
            if 'uid' not in session:
                return jsonify({
                    'code': 401,
                    'message': '您需要登录才能查看个人帖子'
                })
            # 修改这行，使用session中的uid替代current_user
            query = query.filter(Topics.user_id == session['uid'])
        
        # 自定义模式的搜索和筛选
        if mode == 'custom' and search:
            query = query.filter(Topics.title.ilike(f'%{search}%') | Topics.content.ilike(f'%{search}%'))
        
        # 排序 - 修复MySQL中不支持NULLS LAST的问题
        if filter_option == 'popular':
            query = query.order_by(desc(Topics.favorite_count), desc(Topics.create_time))
        else:  # latest
            query = query.order_by(desc(Topics.create_time))
        
        # 添加置顶条件（置顶的排在前面）
        query = query.order_by(
            desc(case((Topics.top == None, 0), else_=1)),
            desc(Topics.top)
        )
        
        # 执行分页查询
        paginated_posts = query.paginate(page=page, per_page=page_size, error_out=False)
        
        # 构建响应数据
        posts_data = []
        for post in paginated_posts.items:
            # 获取用户信息
            user = UserInfo.query.filter_by(uid=post.user_id).first()
            nickname = user.nickname if user else None
            
            # 用户是否已收藏
            is_favorite = False
            # 修改这里，检查session是否有用户
            if 'uid' in session:
                favorite = Favorites.query.filter_by(
                    user_id=session['uid'],
                    topic_id=post.topic_id
                ).first()
                is_favorite = favorite is not None
            
            # 构建帖子数据
            post_data = {
                'topic_id': post.topic_id,
                'user_id': post.user_id,
                'nickname': nickname,
                'title': post.title,
                'content': post.content,
                'create_time': post.create_time.strftime('%Y-%m-%d %H:%M'),
                'favorite_count': post.favorite_count or 0,
                'is_favorite': is_favorite,
                'is_top': bool(post.top)
            }
            posts_data.append(post_data)
        
        return jsonify({
            'success': True,
            'posts': posts_data,
            'total': paginated_posts.total,
            'pages': paginated_posts.pages,
            'current_page': page
        })
    
    except Exception as e:
        current_app.logger.error(f"获取帖子失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': '获取帖子失败',
            'posts': []
        }), 500

@homepage_bp.route('/post', methods=['POST'])
@login_required
def create_post():
    """创建新帖子"""
    try:
        data = request.json
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        
        # 验证数据
        if not title:
            return jsonify({'success': False, 'message': '标题不能为空'})
        if not content:
            return jsonify({'success': False, 'message': '内容不能为空'})
        
        # 创建新帖子
        topic_id = str(uuid.uuid4())
        new_post = Topics(
            topic_id=topic_id,
            # 使用session中的uid替代current_user
            user_id=session['uid'],
            title=title,
            content=content,
            create_time=datetime.now(),
            update_time=datetime.now(),
            state='active',
            favorite_count=0,
            top=0
        )
        
        # 保存到数据库
        db.session.add(new_post)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '发布成功',
            'topic_id': topic_id
        })
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"创建帖子失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': '发布失败，请稍后重试'
        }), 500

@homepage_bp.route('/favorite', methods=['POST'])
@login_required
def toggle_favorite():
    """收藏/取消收藏帖子"""
    try:
        data = request.json
        topic_id = data.get('topic_id')
        
        if not topic_id:
            return jsonify({'success': False, 'message': '参数错误'})
        
        # 查找帖子
        topic = Topics.query.filter_by(topic_id=topic_id).first()
        if not topic:
            return jsonify({'success': False, 'message': '帖子不存在'})
        
        # 查询是否已收藏
        favorite = Favorites.query.filter_by(
            # 使用session中的uid替代current_user
            user_id=session['uid'],
            topic_id=topic_id
        ).first()
        
        if favorite:
            # 取消收藏
            db.session.delete(favorite)
            if topic.favorite_count:
                topic.favorite_count -= 1
            action = 'remove'
        else:
            # 添加收藏
            new_favorite = Favorites(
                # 使用session中的uid替代current_user
                user_id=session['uid'],
                topic_id=topic_id,
                create_time=datetime.now()
            )
            db.session.add(new_favorite)
            if topic.favorite_count is None:
                topic.favorite_count = 1
            else:
                topic.favorite_count += 1
            action = 'add'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'action': action,
            'favorite_count': topic.favorite_count
        })
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"收藏操作失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': '操作失败，请稍后重试'
        }), 500

@homepage_bp.route('/learn-stats')
@login_required
def get_learn_stats():
    """获取用户学习记录热力图数据"""
    try:
        # 从session获取当前用户ID
        user_id = session.get('uid')
        if not user_id:
            return jsonify({
                'success': False,
                'message': '未登录',
                'data': []
            }), 401
        
        # 获取过去90天的日期范围（约3个月）
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=90)
        
        # 查询在这个日期范围内的学习记录
        records = StudyRecord.query.filter(
            StudyRecord.uid == user_id,
            db.func.date(StudyRecord.creattime) >= start_date,
            db.func.date(StudyRecord.creattime) <= end_date
        ).all()
        
        # 统计每天的学习记录数量
        stats = {}
        for record in records:
            date_str = record.creattime.strftime('%Y-%m-%d')
            stats[date_str] = stats.get(date_str, 0) + 1
        
        # 构建返回数据 - 确保包含所有日期，即使没有记录
        result = []
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime('%Y-%m-%d')
            result.append({
                'date': date_str,
                'count': stats.get(date_str, 0)
            })
            current_date += timedelta(days=1)
        
        return jsonify({
            'success': True,
            'data': result
        })
    
    except Exception as e:
        current_app.logger.error(f"获取学习统计数据失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'获取学习统计数据失败: {str(e)}',
            'data': []
        }), 500