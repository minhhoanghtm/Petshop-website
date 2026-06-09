// Jenkinsfile cho project PetShop
// - Pipeline này cài dependency cho backend và frontend.
// - Backend có sẵn lệnh `npm test`, nên pipeline sẽ chạy test backend trước.
// - Frontend hiện chưa có test script riêng, nên pipeline chỉ build bằng Vite.
// - Pipeline này dùng Docker Node để tránh lỗi `libatomic.so.1` trên Jenkins agent.

pipeline {
    agent none

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        BACKEND_DIR = 'back-end'
        FRONTEND_DIR = 'front-end'
        CI = 'true'
    }

    stages {
        stage('Checkout') {
            agent any
            steps {
                checkout scm
            }
        }

        stage('Install Backend') {
            agent {
                docker {
                    image 'node:22-alpine'
                    args '--user root:root'
                }
            }
            steps {
                dir(env.BACKEND_DIR) {
                    sh 'npm ci'
                }
            }
        }

        stage('Install Frontend') {
            agent {
                docker {
                    image 'node:22-alpine'
                    args '--user root:root'
                }
            }
            steps {
                dir(env.FRONTEND_DIR) {
                    sh 'npm ci'
                }
            }
        }

        stage('Test Backend') {
            agent {
                docker {
                    image 'node:22-alpine'
                    args '--user root:root'
                }
            }
            steps {
                dir(env.BACKEND_DIR) {
                    catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                        sh 'npm test'
                    }
                }
            }
        }

        stage('Build Frontend') {
            agent {
                docker {
                    image 'node:22-alpine'
                    args '--user root:root'
                }
            }
            steps {
                dir(env.FRONTEND_DIR) {
                    sh 'npm run build'
                }
            }
        }

        stage('Archive Artifacts') {
            agent any
            steps {
                archiveArtifacts artifacts: 'front-end/dist/**/*',
                    allowEmptyArchive: true,
                    fingerprint: true
            }
        }

        stage('Docker Build Preview') {
            agent any
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                script {
                    echo 'Docker build preview stage'
                    sh 'docker --version || true'
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo 'Jenkins pipeline đã chạy thành công.'
        }
        unstable {
            echo 'Pipeline UNSTABLE: test chưa pass hoàn toàn.'
        }
        failure {
            echo 'Pipeline FAILED. Kiểm tra stage bị lỗi.'
        }
    }
}

