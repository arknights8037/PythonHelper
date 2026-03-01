# Flask-Vue3 Application

This project is a simple multi-page application built with Flask as the backend and Vue 3 as the frontend. It demonstrates how to integrate a Flask server with a Vue.js frontend, allowing for a seamless user experience across multiple pages.

## Project Structure

```
flask-vue3-app
├── app
│   ├── __init__.py        # Initializes the Flask application
│   ├── routes.py          # Defines the application routes
│   ├── static              # Contains static files
│   │   ├── css
│   │   │   └── main.css    # Main CSS styles
│   │   └── js
│   │       └── main.js     # Main JavaScript logic
│   └── templates           # Contains HTML templates
│       ├── base.html       # Base template for all pages
│       ├── index.html      # Homepage template
│       └── page2.html      # Second page template
├── frontend                # Contains the Vue.js frontend
│   ├── package.json        # NPM configuration file
│   ├── src                 # Source files for Vue.js
│   │   ├── assets          # Static assets (images, etc.)
│   │   ├── components      # Vue components
│   │   │   ├── HelloWorld.vue  # Welcome message component
│   │   │   └── NavBar.vue      # Navigation bar component
│   │   ├── pages          # Vue page components
│   │   │   ├── HomePage.vue     # Homepage component
│   │   │   └── SecondPage.vue   # Second page component
│   │   ├── App.vue        # Root component of the Vue application
│   │   └── main.js        # Entry point for the Vue application
│   ├── vite.config.js     # Vite configuration file
│   └── vue.config.js      # Vue CLI configuration file
├── run.py                 # Entry point to run the Flask application
├── requirements.txt       # Python dependencies for Flask
└── README.md              # Project documentation
```

## Getting Started

### Prerequisites

- Python 3.x
- Node.js and npm

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd flask-vue3-app
   ```

2. Set up the Python environment:
   ```
   pip install -r requirements.txt
   ```

3. Navigate to the `frontend` directory and install the Vue.js dependencies:
   ```
   cd frontend
   npm install
   ```

### Running the Application

1. Start the Flask server:
   ```
   python ../run.py
   ```

2. In a new terminal, navigate to the `frontend` directory and start the Vue.js development server:
   ```
   npm run serve
   ```

3. Open your browser and go to `http://localhost:5000` for the Flask application and `http://localhost:3000` for the Vue.js application.

### Contributing

Feel free to submit issues or pull requests for any improvements or bug fixes.

### License

This project is licensed under the MIT License.