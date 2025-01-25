const { createApp } = Vue;

createApp({
    data() {
        return {
            questions: [],
            currentQuestionIndex: 0,
            answered: false,
            selectedAnswer: null,
            score: 0,
            quizCompleted: false,
            showPlayButton: true,
            player: null,
            isVideoReady: false,
            isVideoEnded: false,
            isDarkMode: false,
            userAnswers: [],
            testSelected: false,
            currentTest: null,
            showWarningMessage: false,
            warningFade: false,
            warningTimeout: null,
            videoId: null,
            answers: [],
            categories: [],
            autoPlay: true,
            soundEnabled: true,
            isIntroPlaying: false,
            introTimer: 180,
            introInterval: null,
            showStartButton: false,
            isMuted: true,
            introStartTime: 0,
            quizStarted: false,
            isPremium: false,
            hideRecommendations: false,
            defaultQuestion: "Kime oy verir?"
        }
    },
    computed: {
        siteUrl() {
            // Tam URL'i döndür (path dahil)
            return window.location.href.split('?')[0];
        },
        currentQuestion() {
            return this.questions[this.currentQuestionIndex] || null;
        }
    },
    methods: {
        setCookie(name, value, days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = `expires=${date.toUTCString()}`;
            document.cookie = `${name}=${value};${expires};path=/`;
        },
        getCookie(name) {
            const decodedCookie = decodeURIComponent(document.cookie);
            const cookies = decodedCookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                let c = cookies[i].trim();
                if (c.indexOf(`${name}=`) === 0) {
                    return c.substring(name.length + 1, c.length);
                }
            }
            return null;
        },
        toggleDarkMode() {
            this.isDarkMode = !this.isDarkMode;
            document.documentElement.classList.toggle('dark', this.isDarkMode);
            this.setCookie('darkMode', this.isDarkMode, 30);
        },
        togglePremium() {
            this.isPremium = !this.isPremium;
            this.setCookie('isPremium', this.isPremium, 30);
        },
        toggleAutoPlay() {
            this.autoPlay = !this.autoPlay;
            this.setCookie('autoPlay', this.autoPlay, 30);
        },
        toggleSound() {
            this.soundEnabled = !this.soundEnabled;
            this.setCookie('soundEnabled', this.soundEnabled, 30);
        },
        async selectTest(testName) {
            this.currentTest = testName;
            window.history.pushState({}, '', `?quiz=${testName}`);
            await this.loadQuestions();
            this.testSelected = true;
            
            // Premium kullanıcılar için intro'yu atla
            if (this.isPremium) {
                this.quizStarted = true;
                this.isIntroPlaying = false;
                this.showStartButton = false;
                this.updateVideo();
            } else {
                this.playIntroVideo();
            }
        },
        async loadQuestions() {
            try {
                const response = await fetch(`questions/${this.currentTest}.json`);
                const data = await response.json();
                this.videoId = data.videoId;
                this.answers = data.answers;
                this.questions = data.questions;
                this.hideRecommendations = data.hideRecommendations || false;
                if (data.question) {
                    this.defaultQuestion = data.question;
                }
                this.userAnswers = new Array(this.questions.length).fill(null);
                this.loadYouTubeAPI();
            } catch (error) {
                console.error('Sorular yüklenirken hata oluştu:', error);
            }
        },
        loadYouTubeAPI() {
            if (!window.YT) {
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                window.onYouTubeIframeAPIReady = () => {
                    this.createPlayer();
                };
            } else {
                this.createPlayer();
            }
        },
        createPlayer() {
            if (this.player) {
                this.player.destroy();
            }

            this.showPlayButton = false;
            this.player = new YT.Player('player', {
                height: '100%',
                width: '100%',
                videoId: this.videoId,
                playerVars: {
                    controls: 0,
                    disablekb: 1,
                    modestbranding: 1,
                    rel: 0,
                    mute: 1,
                    playsinline: 1,
                    showinfo: 0,
                    iv_load_policy: 3,
                    fs: 0,
                    origin: window.location.origin
                },
                events: {
                    onReady: this.onPlayerReady,
                    onStateChange: this.onPlayerStateChange,
                    onError: this.onPlayerError
                }
            });
        },
        onPlayerReady(event) {
            this.isVideoReady = true;
            this.showPlayButton = false;

            // Eğer intro oynatılıyorsa video baştan başlasın
            if (this.isIntroPlaying) {
                event.target.seekTo(0);
                event.target.mute();
                event.target.playVideo();
            } else {
                // Normal quiz akışı
                event.target.seekTo(this.currentQuestion.startTime);
                event.target.playVideo();
                
                setTimeout(() => {
                    if (this.player) {
                        event.target.pauseVideo();
                        if (this.autoPlay && this.answered) {
                            this.playVideo();
                        }
                    }
                }, 500);
            }
        },
        onPlayerStateChange(event) {
            // Video durumları: -1 (başlatılmamış), 0 (bitmiş), 1 (oynatılıyor), 2 (duraklatılmış), 3 (tamponlanıyor), 5 (video işareti)
            if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) {
                this.showPlayButton = true;
                if (event.data === YT.PlayerState.ENDED) {
                    this.isVideoEnded = true;
                }
            } else if (event.data === YT.PlayerState.PLAYING) {
                this.showPlayButton = false;
                this.isVideoEnded = false;
            }
        },
        onPlayerError(event) {
            console.error('Video yüklenirken hata:', event.data);
        },
        playVideo() {
            // Soru cevaplanmamışsa videoyu oynatma
            if (!this.answered) {
                this.showWarning();
                return;
            }

            if (!this.player || !this.isVideoReady) return;

            this.player.seekTo(this.currentQuestion.startTime);
            this.player.unMute();
            this.player.playVideo();
            this.showPlayButton = false;
            this.isVideoEnded = false;

            // Video bitiş zamanını kontrol et
            const checkTime = setInterval(() => {
                if (!this.player) {
                    clearInterval(checkTime);
                    return;
                }

                const currentTime = this.player.getCurrentTime();
                if (currentTime >= this.currentQuestion.endTime) {
                    this.player.pauseVideo();
                    clearInterval(checkTime);
                    this.showPlayButton = true;
                    this.isVideoEnded = true;
                }
            }, 100);
        },
        updateVideo() {
            if (!this.player || !this.isVideoReady) return;

            this.showPlayButton = false;
            this.isVideoEnded = false;
            this.player.mute();
            
            // Video pozisyonunu güncelle
            this.player.seekTo(this.currentQuestion.startTime);
            this.player.pauseVideo();
            this.player.unMute();
        },
        playCorrectSound() {
            if (!this.soundEnabled) return;
            try {
                const sound = document.getElementById('correctSound');
                sound.volume = 0.1;
                sound.currentTime = 0;
                const playPromise = sound.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Ses çalma hatası:", error);
                    });
                }
            } catch (error) {
                console.log("Ses çalma hatası:", error);
            }
        },
        playWrongSound() {
            if (!this.soundEnabled) return;
            try {
                const sound = document.getElementById('wrongSound');
                sound.volume = 0.1;
                sound.currentTime = 0;
                const playPromise = sound.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Ses çalma hatası:", error);
                    });
                }
            } catch (error) {
                console.log("Ses çalma hatası:", error);
            }
        },
        showConfetti() {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        },
        checkAnswer(index) {
            this.answered = true;
            this.selectedAnswer = index;
            this.userAnswers[this.currentQuestionIndex] = index;
            
            if (index === this.currentQuestion.correctAnswer) {
                this.score++;
                this.playCorrectSound();
                this.showConfetti();
            } else {
                this.playWrongSound();
                const button = document.querySelectorAll('.answer-button')[index];
                button.classList.add('pulse-wrong', 'fade-in');
                
                // Doğru cevabı göster
                const correctButton = document.querySelectorAll('.answer-button')[this.currentQuestion.correctAnswer];
                correctButton.classList.add('fade-in');
                
                setTimeout(() => {
                    button.classList.remove('pulse-wrong', 'fade-in');
                    correctButton.classList.remove('fade-in');
                }, 1000);
            }

            // Soru cevaplandıktan sonra play butonunu göster (otomatik oynatma kapalıysa)
            this.showPlayButton = !this.autoPlay;
            
            if (this.autoPlay) {
                this.playVideo();
            }
        },
        nextQuestion() {
            if (this.currentQuestionIndex < this.questions.length - 1) {
                this.currentQuestionIndex++;
                this.resetQuestion();
                this.updateVideo();
            } else {
                this.quizCompleted = true;
            }
        },
        resetQuestion() {
            this.answered = false;
            this.selectedAnswer = null;
            this.showPlayButton = true;
            this.isVideoEnded = false;
        },
        getResultMessage() {
            const percentage = (this.score / this.questions.length) * 100;
            if (percentage === 100) return "Mükemmel! Tüm soruları doğru bildin! 🏆";
            if (percentage >= 80) return "Harika bir sonuç! 🌟";
            if (percentage >= 60) return "İyi iş çıkardın! 👏";
            if (percentage >= 40) return "Biraz daha pratik yapmalısın! 💪";
            return "Daha çok çalışman gerekiyor! 📚";
        },
        async shareResults() {
            try {
                const element = document.getElementById('shareImage');
                
                // Geçici olarak görünür yap ve pozisyonla
                const originalStyles = {
                    position: element.style.position,
                    top: element.style.top,
                    left: element.style.left,
                    width: element.style.width,
                    height: element.style.height,
                    zIndex: element.style.zIndex,
                    opacity: element.style.opacity,
                    overflow: element.style.overflow
                };

                // Render için görünür yap
                element.style.position = 'fixed';
                element.style.top = '0';
                element.style.left = '0';
                element.style.width = '1080px';
                element.style.height = '1920px';
                element.style.zIndex = '-1';
                element.style.opacity = '1';
                element.style.overflow = 'hidden';
                
                // Canvas oluştur
                const canvas = await html2canvas(element, {
                    backgroundColor: this.isDarkMode ? '#1a1a1a' : '#ffffff',
                    width: 1080,
                    height: 1920,
                    scale: 1,
                    logging: false,
                    useCORS: true
                });
                
                // Orijinal stilleri geri yükle
                Object.keys(originalStyles).forEach(key => {
                    element.style[key] = originalStyles[key];
                });
                
                // Story container oluştur
                const storyContainer = document.createElement('div');
                storyContainer.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4';
                
                // Story görselini oluştur
                const storyImage = document.createElement('img');
                storyImage.src = canvas.toDataURL('image/png');
                storyImage.className = 'max-w-full max-h-full object-contain';
                
                // Kapatma butonu
                const closeButton = document.createElement('button');
                closeButton.innerHTML = '<i class="fas fa-times"></i>';
                closeButton.className = 'fixed top-4 right-4 z-50 p-2 rounded-full bg-black/20 text-white hover:bg-black/30 transition-all';
                
                // Bilgi mesajı
                const infoText = document.createElement('div');
                infoText.className = 'fixed bottom-6 left-0 right-0 text-center text-sm text-gray-300';
                infoText.textContent = 'Paylaşmak için ekran görüntüsü alabilirsiniz';
                
                // Elementleri ekle
                storyContainer.appendChild(storyImage);
                document.body.appendChild(storyContainer);
                document.body.appendChild(closeButton);
                document.body.appendChild(infoText);
                
                // Kapatma fonksiyonu
                const closeStory = () => {
                    storyContainer.remove();
                    closeButton.remove();
                    infoText.remove();
                };
                
                // Kapatma olayları
                closeButton.onclick = closeStory;
                storyContainer.onclick = (e) => {
                    if (e.target === storyContainer) closeStory();
                };
                
                // ESC tuşu ile kapatma
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') closeStory();
                }, { once: true });
                
            } catch (error) {
                console.error('Story görüntülenirken hata:', error);
            }
        },
        restartQuiz() {
            this.testSelected = false;
            this.currentTest = null;
            this.currentQuestionIndex = 0;
            this.answered = false;
            this.selectedAnswer = null;
            this.score = 0;
            this.quizCompleted = false;
            this.userAnswers = [];
            this.videoId = null;
            this.answers = [];
            
            if (this.player) {
                this.player.destroy();
                this.player = null;
            }
        },
        showWarning() {
            // Eğer önceki timeout varsa temizle
            if (this.warningTimeout) {
                clearTimeout(this.warningTimeout);
                this.showWarningMessage = false;
                this.warningFade = false;
            }
            
            // Uyarıyı göster
            this.showWarningMessage = true;
            this.warningFade = false;
            
            // 2 saniye sonra fade efekti başlat
            this.warningTimeout = setTimeout(() => {
                this.warningFade = true;
                // Fade bittikten sonra mesajı kaldır
                setTimeout(() => {
                    this.showWarningMessage = false;
                    this.warningFade = false;
                }, 300);
            }, 2000);
        },
        async loadCategories() {
            try {
                const response = await fetch('categories.json');
                const data = await response.json();
                this.categories = data.categories;
            } catch (error) {
                console.error('Kategoriler yüklenirken hata oluştu:', error);
            }
        },
        // URL'den quiz parametresini kontrol et
        checkUrlParams() {
            const urlParams = new URLSearchParams(window.location.search);
            const quizParam = urlParams.get('quiz');
            if (quizParam) {
                this.selectTest(quizParam);
            }
        },
        playIntroVideo() {
            this.isIntroPlaying = true;
            this.introTimer = 180;
            this.isMuted = true;
            
            if (this.player) {
                this.player.seekTo(0); // Her zaman videonun başından başla
                this.player.mute();
                this.player.playVideo();
            }

            this.introInterval = setInterval(() => {
                this.introTimer--;
                if (this.introTimer <= 0) {
                    this.stopIntroVideo();
                }
            }, 1000);
        },
        toggleMute() {
            if (this.player) {
                if (this.isMuted) {
                    this.player.unMute();
                    this.isMuted = false;
                } else {
                    this.player.mute();
                    this.isMuted = true;
                }
            }
        },
        stopIntroVideo() {
            clearInterval(this.introInterval);
            this.showStartButton = true;
            this.isIntroPlaying = true;
            if (!this.isMuted && this.player) {
                this.player.mute();
                this.isMuted = true;
            }
        },
        startQuiz() {
            this.quizStarted = true;
            this.showStartButton = false;
            this.showPlayButton = false;
            this.isIntroPlaying = false;
            this.updateVideo();
        }
    },
    mounted() {
        this.loadCategories();
        this.checkUrlParams();
        
        // Dark mode tercihini kontrol et
        const darkModePreference = this.getCookie('darkMode');
        if (darkModePreference) {
            this.isDarkMode = darkModePreference === 'true';
        } else {
            this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        document.documentElement.classList.toggle('dark', this.isDarkMode);
        
        // Sistem dark mode değişikliğini dinle
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
            if (!this.getCookie('darkMode')) {
                this.isDarkMode = event.matches;
                document.documentElement.classList.toggle('dark', this.isDarkMode);
            }
        });

        // Premium durumunu kontrol et
        const premiumPreference = this.getCookie('isPremium');
        if (premiumPreference !== null) {
            this.isPremium = premiumPreference === 'true';
        }

        // Otomatik oynatma tercihini kontrol et
        const autoPlayPreference = this.getCookie('autoPlay');
        if (autoPlayPreference !== null) {
            this.autoPlay = autoPlayPreference === 'true';
        }

        // Ses tercihini kontrol et
        const soundPreference = this.getCookie('soundEnabled');
        if (soundPreference !== null) {
            this.soundEnabled = soundPreference === 'true';
        }
    }
}).mount('#app'); 