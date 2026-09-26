package com.heungkuk.academy.global.security.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import com.heungkuk.academy.global.security.handler.JwtAccessDeniedHandler;
import com.heungkuk.academy.global.security.handler.JwtAuthenticationEntryPoint;
import com.heungkuk.academy.global.security.jwt.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    private final JwtAccessDeniedHandler jwtAccessDeniedHandler;

    @Value("${app.cors.allowed-origins}")
    private List<String> allowedOrigins;

    // springdoc 활성화 여부 (로컬: 기본값 true / docker: false) — Swagger 경로 공개 여부도 같이 따라간다
    @Value("${springdoc.api-docs.enabled:true}")
    private boolean swaggerEnabled;

    private static final String[] SWAGGER_PATHS = {"/swagger-ui/**", "/swagger-ui.html",
            "/v3/api-docs/**", "/v3/api-docs", "/webjars/**"};

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(
                        session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // async dispatch 시 SecurityContext 유지: request 속성에 저장 → async 재사용 가능
                .securityContext(ctx -> ctx
                        .securityContextRepository(new RequestAttributeSecurityContextRepository()))
                // 미인증 → 401, 권한 부족 → 403 (CommonResponse 형식)
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                        .accessDeniedHandler(jwtAccessDeniedHandler))
                .authorizeHttpRequests(auth -> {
                    // Swagger 는 springdoc 이 켜진 환경(로컬)에서만 공개
                    if (swaggerEnabled) {
                        auth.requestMatchers(SWAGGER_PATHS).permitAll();
                    }
                    auth
                        .requestMatchers("/v1/auth/**", "/v1/survey/**",
                                "/actuator/health", "/actuator/prometheus")
                        .permitAll()
                        // Excel 다운로드/내보내기/가져오기는 ROLE_ADMIN만 가능
                        .requestMatchers(HttpMethod.GET,
                                "/v1/admin/reservations/*/estimate",
                                "/v1/admin/reservations/*/trade",
                                "/v1/admin/reservations/*/confirmation",
                                "/v1/admin/reservations/export")
                        .hasAuthority("ROLE_ADMIN")
                        // 그 외 GET 조회는 인증된 사용자라면 누구나 가능
                        .requestMatchers(HttpMethod.GET, "/v1/admin/**").authenticated()
                        // 본인 비밀번호 변경은 누구나 가능
                        .requestMatchers(HttpMethod.PATCH, "/v1/admin/accounts/me/password")
                        .authenticated()
                        // 생성/수정/삭제는 ROLE_ADMIN만 가능
                        .requestMatchers(HttpMethod.POST, "/v1/admin/**").hasAuthority("ROLE_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/v1/admin/**").hasAuthority("ROLE_ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/v1/admin/**")
                        .hasAuthority("ROLE_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/v1/admin/**")
                        .hasAuthority("ROLE_ADMIN").anyRequest().authenticated();
                })
                .addFilterBefore(jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * CORS 설정 — http.cors() 가 SecurityFilterChain 맨 앞에서 사용하므로 401/403 응답에도 CORS 헤더가 붙는다.
     * 허용 origin 은 app.cors.allowed-origins (로컬: localhost:3000 / docker: 운영 도메인)
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException(username);
        };
    }

}
