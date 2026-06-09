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
        LD_LIBRARY_PATH = "${WORKSPACE}/libs"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Setup Environment') {
            steps {
                sh '''
                    echo "=== Checking for libatomic.so.1 ==="
                    if ldconfig -p 2>/dev/null | grep -q libatomic || /sbin/ldconfig -p 2>/dev/null | grep -q libatomic || /usr/sbin/ldconfig -p 2>/dev/null | grep -q libatomic; then
                        echo "libatomic.so.1 is already present on the system."
                    else
                        echo "libatomic.so.1 is missing. Attempting to install..."
                        
                        # 1. Try system package managers if root/sudo is available
                        if command -v apt-get >/dev/null 2>&1; then
                            echo "Debian/Ubuntu detected. Trying apt-get..."
                            apt-get update && apt-get install -y libatomic1 || sudo apt-get update && sudo apt-get install -y libatomic1 || true
                        elif command -v apk >/dev/null 2>&1; then
                            echo "Alpine detected. Trying apk..."
                            apk add --no-cache libatomic || sudo apk add --no-cache libatomic || true
                        elif command -v yum >/dev/null 2>&1; then
                            echo "RedHat/CentOS detected. Trying yum..."
                            yum install -y libatomic || sudo yum install -y libatomic || true
                        fi
                        
                        # 2. If still missing, download & extract libatomic1 for non-root users
                        if [ ! -f "$WORKSPACE/libs/libatomic.so.1" ]; then
                            echo "System installation failed or not permitted. Falling back to local library extraction..."
                            mkdir -p "$WORKSPACE/libs"
                            cd "$WORKSPACE/libs"
                            
                            # Detect architecture
                            ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
                            if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
                                DEB_ARCH="amd64"
                            elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
                                DEB_ARCH="arm64"
                            else
                                DEB_ARCH="amd64"
                            fi
                            
                            # Direct package download URLs from Debian mirrors (POSIX compliant space-separated string instead of Bash array)
                            URLs="http://ftp.debian.org/debian/pool/main/g/gcc-12/libatomic1_12.2.0-14_${DEB_ARCH}.deb http://ftp.debian.org/debian/pool/main/g/gcc-10/libatomic1_10.2.1-6_${DEB_ARCH}.deb http://ftp.debian.org/debian/pool/main/g/gcc-14/libatomic1_14.2.0-4_${DEB_ARCH}.deb"
                            
                            DOWNLOAD_SUCCESS=false
                            # Try downloading via apt-get download first (works if local cache is populated)
                            if command -v apt-get >/dev/null 2>&1; then
                                echo "Attempting apt-get download..."
                                apt-get download libatomic1 && DOWNLOAD_SUCCESS=true || true
                            fi
                            
                            # Fallback to direct URLs from Debian mirrors
                            if [ "$DOWNLOAD_SUCCESS" = "false" ]; then
                                for url in $URLs; do
                                    echo "Downloading from mirror: $url"
                                    if wget -q --timeout=10 "$url" -O libatomic1.deb || curl -s -f --connect-timeout 10 "$url" -o libatomic1.deb; then
                                        echo "Download succeeded from mirror."
                                        DOWNLOAD_SUCCESS=true
                                        break
                                    fi
                                done
                            fi
                            
                            if [ "$DOWNLOAD_SUCCESS" = "true" ]; then
                                echo "Extracting package..."
                                dpkg -x libatomic1*.deb . || dpkg-deb -x libatomic1*.deb . || true
                                
                                # Move extracted shared library to $WORKSPACE/libs
                                find . -name "libatomic.so.1*" -exec cp {} . ';'
                                if [ -f libatomic.so.1.* ] && [ ! -h libatomic.so.1 ]; then
                                    ln -sf libatomic.so.1.* libatomic.so.1
                                fi
                                echo "Local libatomic.so.1 successfully configured in $WORKSPACE/libs"
                                ls -la
                            else
                                echo "WARNING: Failed to download libatomic1 package."
                            fi
                        fi
                    fi
                '''
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
                    sh 'npm install'
                }
            }
        }

        stage('Install Frontend Dependencies') {
            steps {
                dir(env.FRONTEND_DIR) {
                    sh 'npm install'
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