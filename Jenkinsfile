// Jenkinsfile cho project PetShop
// - Pipeline này cài dependency cho backend và frontend.
// - Backend có sẵn lệnh `npm test`, nên pipeline sẽ chạy test backend trước.
// - Frontend hiện chưa có test script riêng, nên pipeline chỉ build bằng Vite.
// - Pipeline này dùng Docker Node để tránh lỗi `libatomic.so.1` trên Jenkins agent.

pipeline {

```
agent any

tools {
    // Phải trùng với tên NodeJS trong:
    // Manage Jenkins -> Tools
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
            sh '''
                docker --version || true
            '''
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
```

}

