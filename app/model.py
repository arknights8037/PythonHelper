from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class UserInfo(db.Model):
    __tablename__ = 'userinfo'
    
    uid = db.Column(db.String(255), primary_key=True, comment='用户id')
    password = db.Column(db.String(255), nullable=False, comment='密码')
    nickname = db.Column(db.String(255), nullable=False, comment='昵称/用户名')
    admin = db.Column(db.SmallInteger, default=0, comment='是否为管理员')
    signuptime = db.Column(db.DateTime, default=datetime.now, comment='注册时间')
    persona=db.Column(db.Text, comment='用户画像')
    
    def __init__(self, uid, password, nickname, admin=0):
        self.uid = uid
        self.set_password(password)
        self.nickname = nickname
        self.admin = admin
        self.signuptime = datetime.now()  # 显式设置注册时间
        
    def set_password(self, password):
        self.password = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password, password)
    
    def to_dict(self):
        return {
            'uid': self.uid,
            'nickname': self.nickname,
            'admin': self.admin,
            'signuptime': self.signuptime.strftime('%Y-%m-%d %H:%M:%S') if self.signuptime else None
        }
    

class FeedBack(db.Model):
    __tablename__ = 'feedback'
    
    fid = db.Column(db.String(255), primary_key=True, comment='反馈id')
    title = db.Column(db.String(255), comment='标题')
    content = db.Column(db.Text, comment='内容')
    creattime = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    state = db.Column(db.SmallInteger, default=0, comment='处理状态')
    
    def __init__(self, fid, title=None, content=None, state=0):
        self.fid = fid
        self.title = title
        self.content = content
        self.creattime = datetime.now()
        self.state = state
        
    def to_dict(self):
        return {
            'fid': self.fid,
            'title': self.title,
            'content': self.content,
            'creattime': self.creattime.strftime('%Y-%m-%d %H:%M:%S') if self.creattime else None,
            'state': self.state
        }

class Code(db.Model):
    __tablename__ = 'code'
    
    cid = db.Column(db.String(255), primary_key=True, comment='代码id')
    uid = db.Column(db.String(255), db.ForeignKey('userinfo.uid', ondelete='CASCADE', onupdate='CASCADE'), comment='用户id')
    filename = db.Column(db.String(255), comment='文件名')  
    code = db.Column(db.Text, comment='代码内容')
    chatrecord = db.Column(db.Text, comment='对话记录')
    creattime = db.Column(db.DateTime, default=datetime.now, comment='代码创建时间')
    
    # 建立与UserInfo的关系
    user = db.relationship('UserInfo', backref=db.backref('codes', lazy=True))
    
    def __init__(self, cid, uid,filename, code=None, chatrecord=None):
        self.cid = cid
        self.uid = uid
        self.filename = filename
        self.code = code
        self.chatrecord = chatrecord
        self.creattime = datetime.now()
        
    def to_dict(self):
        return {
            'cid': self.cid,
            'uid': self.uid,
            'filename': self.filename,
            'code': self.code,
            'chatrecord': self.chatrecord,
            'creattime': self.creattime.strftime('%Y-%m-%d %H:%M:%S') if self.creattime else None
        }


# ...existing code...

class Note(db.Model):
    __tablename__ = 'note'
    
    nid = db.Column(db.String(255), primary_key=True, comment='笔记id')
    uid = db.Column(db.String(255), db.ForeignKey('userinfo.uid', ondelete='CASCADE', onupdate='CASCADE'), comment='用户id')
    title = db.Column(db.String(255), comment='笔记标题')
    abstract = db.Column(db.Text, comment='笔记摘要')
    content = db.Column(db.Text, comment='笔记内容')
    state = db.Column(db.String(16), comment='笔记状态')
    top = db.Column(db.SmallInteger, comment='是否置顶')
    collection = db.Column(db.Integer, comment='收藏数量')
    createtime = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    update = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')
    tag = db.Column(db.JSON, comment='笔记标签')
    
    # 建立与UserInfo的关系
    user = db.relationship('UserInfo', backref=db.backref('notes', lazy=True))
    
    def __init__(self, nid, uid, title=None, abstract=None, content=None, state=None, top=0, collection=0, tag=None):
        self.nid = nid
        self.uid = uid
        self.title = title
        self.abstract = abstract
        self.content = content
        self.state = state
        self.top = top
        self.collection = collection
        self.createtime = datetime.now()
        self.update = datetime.now()
        self.tag = tag or []
        
    def to_dict(self):
        return {
            'nid': self.nid,
            'uid': self.uid,
            'title': self.title,
            'abstract': self.abstract,
            'content': self.content,
            'state': self.state,
            'top': self.top,
            'collection': self.collection,
            'createtime': self.createtime.strftime('%Y-%m-%d %H:%M:%S') if self.createtime else None,
            'update': self.update.strftime('%Y-%m-%d %H:%M:%S') if self.update else None,
            'tag': self.tag
        }
    
# ...existing code...

class Topics(db.Model):
    __tablename__ = 'topics'
    topic_id = db.Column(db.String(64), primary_key=True, comment='话题id')
    user_id = db.Column(db.String(64), db.ForeignKey('userinfo.uid'), nullable=False, comment='用户id')
    title = db.Column(db.String(64), nullable=True, comment='话题标题')
    content = db.Column(db.Text, nullable=True, comment='话题内容')
    create_time = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    update_time = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')
    state = db.Column(db.String(16), nullable=True, comment='状态')
    classify = db.Column(db.String(16), nullable=True, comment='分类')
    favorite_count = db.Column(db.Integer, nullable=True, comment='收藏数')
    top = db.Column(db.SmallInteger, nullable=True, comment='是否置顶')

    user = db.relationship('UserInfo', backref=db.backref('user_topics', lazy=True))

class Comments(db.Model):
    __tablename__ = 'comments'
    comment_id = db.Column(db.String(64), primary_key=True, comment='评论id')
    user_id = db.Column(db.String(64), db.ForeignKey('userinfo.uid'), nullable=False, comment='用户id')
    topic_id = db.Column(db.String(64), db.ForeignKey('topics.topic_id'), nullable=False, comment='话题id')
    comment = db.Column(db.Text, nullable=True, comment='评论内容')
    create_time = db.Column(db.DateTime, default=datetime.now, comment='创建时间')

    user = db.relationship('UserInfo', backref=db.backref('user_comments', lazy=True))
    topic = db.relationship('Topics', backref=db.backref('topic_comments', lazy=True))

class Favorites(db.Model):
    __tablename__ = 'favorites'
    user_id = db.Column(db.String(64), db.ForeignKey('userinfo.uid'), primary_key=True, nullable=False, comment='用户id')
    topic_id = db.Column(db.String(64), db.ForeignKey('topics.topic_id'), primary_key=True, nullable=False, comment='话题id')
    create_time = db.Column(db.DateTime, default=datetime.now, comment='创建时间')

    user = db.relationship('UserInfo', backref=db.backref('user_favorites', lazy=True))
    topic = db.relationship('Topics', backref=db.backref('topic_favorites', lazy=True))



# ...existing code...

class StudyRecord(db.Model):
    __tablename__ = 'StudyRecord'
    
    rid = db.Column(db.String(255), primary_key=True, comment='记录ID，主键')
    uid = db.Column(db.String(255), db.ForeignKey('userinfo.uid', ondelete='CASCADE', onupdate='CASCADE'), comment='用户名，外键，关联userinfo')
    record = db.Column(db.Text, comment='记录内容')
    title = db.Column(db.String(255), comment='标题')
    creattime = db.Column(db.DateTime, default=datetime.now, comment='记录创建时间')
    
    # 建立与UserInfo的关系
    user = db.relationship('UserInfo', backref=db.backref('study_records', lazy=True))
    
    def __init__(self, rid, uid, record=None, title=None):
        self.rid = rid
        self.uid = uid
        self.record = record
        self.title = title
        self.creattime = datetime.now()
        
    def to_dict(self):
        return {
            'rid': self.rid,
            'uid': self.uid,
            'record': self.record,
            'title': self.title,
            'creattime': self.creattime.strftime('%Y-%m-%d %H:%M:%S') if self.creattime else None
        }
    
class Summary(db.Model):
    __tablename__ = 'summary'
    
    sid = db.Column(db.String(255), primary_key=True, comment='摘要ID')
    uid = db.Column(db.String(255), db.ForeignKey('userinfo.uid', ondelete='CASCADE', onupdate='CASCADE'), comment='用户ID')
    tag = db.Column(db.String(255), comment='标签')
    summary = db.Column(db.Text, comment='摘要内容')
    create_time = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    
    # 建立与UserInfo的关系
    user = db.relationship('UserInfo', backref=db.backref('summaries', lazy=True))
    
    def __init__(self, sid, uid, tag=None, summary=None):
        self.sid = sid
        self.uid = uid
        self.tag = tag
        self.summary = summary
        self.create_time = datetime.now()
        
    def to_dict(self):
        return {
            'sid': self.sid,
            'uid': self.uid,
            'tag': self.tag,
            'summary': self.summary,
            'create_time': self.create_time.strftime('%Y-%m-%d %H:%M:%S') if self.create_time else None
        }