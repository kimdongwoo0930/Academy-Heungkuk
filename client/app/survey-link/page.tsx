import styles from '../survey/[token]/page.module.css';

// 설문 링크로 들어온 뒤 주소가 /survey-link 로 바뀌므로, 새로고침하면 이 화면이 보인다
export default function SurveyLinkPage() {
    return (
        <div className={styles.container}>
            <div className={styles.successCard}>
                <h2 className={styles.successTitle}>설문 링크를 다시 열어주세요</h2>
                <p className={styles.successDesc}>
                    보안을 위해 설문 주소는 숨겨져 있습니다.
                    <br />
                    받으신 링크로 다시 접속해주세요.
                </p>
            </div>
        </div>
    );
}
