// Jenkinsfile cho project PetShop
// - Pipeline này cài dependency cho backend và frontend.
// - Backend có sẵn lệnh `npm test`, nên pipeline sẽ chạy test backend trước.
// - Frontend hiện chưa có test script riêng, nên pipeline chỉ build bằng Vite.
// - Nếu Jenkins agent có Docker, có thể mở rộng thêm stage build/push image.

pipeline {
    agent any

    tools {
        // Tên phải trùng với NodeJS installation trong Jenkins Tools
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
}

stages {

    stage('Checkout') {
        steps {
            checkout scm
        }
    }

    stage('Install Backend') {
        steps {
            dir(env.BACKEND_DIR) {
                sh 'npm ci'
            }
        }
    }

    stage('Install Frontend') {
        steps {
            dir(env.FRONTEND_DIR) {
                sh 'npm ci'
            }
        }
    }

    stage('Test Backend') {
        steps {
            dir(env.BACKEND_DIR) {

                catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
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

    stage('Archive Artifacts') {
        steps {
            archiveArtifacts artifacts: 'front-end/dist/**/*',
                allowEmptyArchive: true,
                fingerprint: true
        }
    }

    stage('Docker Build Preview') {

        when {
            anyOf {
                branch 'main'
                branch 'master'
            }
        }

        steps {
            script {
                echo 'Docker build preview stage'

                sh '''
                    docker --version || true
                '''
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

