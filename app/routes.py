from flask import Blueprint, render_template

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('login.html')

@main.route('/homepage')
def homepage():
    return render_template('homepage.html')

@main.route('/learn')
def learn():
    return render_template('learn.html')

@main.route('/note')
def note():
    return render_template('note.html')

@main.route('/code')
def code():
    return render_template('code.html')

@main.route('/user')
def user():
    return render_template('user.html')