pipeline {

    agent any

    tools {
        nodejs 'Node 22'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        BACKEND_DIR = 'back-end'
        FRONTEND_DIR = 'front-end'
        CI = 'true'
        NODE_ENV = 'test'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Show Environment') {
            steps {
                sh 'node -v'
                sh 'npm -v'
            }
        }

        stage('Install Backend Dependencies') {
            steps {
                dir(env.BACKEND_DIR) {
                    sh 'npm ci'
                }
            }
        }

        stage('Install Frontend Dependencies') {
            steps {
                dir(env.FRONTEND_DIR) {
                    sh 'npm ci'
                }
            }
        }

        stage('Run Backend Tests') {
            steps {
                dir(env.BACKEND_DIR) {

                    catchError(
                        buildResult: 'UNSTABLE',
                        stageResult: 'UNSTABLE'
                    ) {
                        sh 'npm test'
                    }
                }
            }
        }

        stage('Build Frontend') {
            steps {
                dir(env.FRONTEND_DIR) {
                    sh 'npm run build'
                }
            }
        }

        stage('Archive Frontend Artifacts') {
            steps {
                archiveArtifacts(
                    artifacts: 'front-end/dist/**/*',
                    allowEmptyArchive: true,
                    fingerprint: true
                )
            }
        }

        stage('Docker Check') {
            steps {
                sh 'docker --version || true'
            }
        }

    }

    post {

        success {
            echo 'Pipeline completed successfully.'
        }

        unstable {
            echo 'Pipeline unstable: some tests failed.'
        }

        failure {
            echo 'Pipeline failed. Check logs.'
        }

        always {
            cleanWs()
        }
    }
}