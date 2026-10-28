package com.heungkuk.academy.domain.setting.service;

import java.util.*;
import java.util.stream.Collectors;

import com.heungkuk.academy.global.entity.LogNames;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.heungkuk.academy.domain.setting.entity.AppSetting;
import com.heungkuk.academy.domain.setting.repository.AppSettingRepository;
import lombok.RequiredArgsConstructor;

@Service
@Slf4j(topic = LogNames.SETTING)
@RequiredArgsConstructor
public class AppSettingServiceImpl implements AppSettingService {

    private final AppSettingRepository appSettingRepository;


    @Override
    @Transactional(readOnly = true)
    public Map<String, String> getAll() {
        return appSettingRepository.findAll().stream()
                .collect(Collectors.toMap(AppSetting::getSettingKey, AppSetting::getSettingValue));
    }

    @Override
    @Transactional
    public void saveAll(Map<String, String> settings, String userId) {
        Map<String, String> changes = new LinkedHashMap<>();

        for (Map.Entry<String, String> entry : settings.entrySet()) {
            String key = entry.getKey();
            String newValue = entry.getValue();

            appSettingRepository.findBySettingKey(key).ifPresentOrElse(
                    s -> {
                        String oldValue = s.getSettingValue();
                        if (!Objects.equals(oldValue, newValue)) {
                            changes.put(key, oldValue + "→" + newValue);
                        }
                        s.updateValue(newValue);
                    },
                    () -> {
                        changes.put(key, "(신규)→" + newValue);
                        appSettingRepository.save(AppSetting.of(key, newValue));
                    });
        }

        if (changes.isEmpty()) {
            log.info("설정 수정 요청 - 변경 사항 없음 수정자={}", userId);
        } else {
            log.info("설정 수정 완료 수정자={} 변경점={}", userId, changes);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getDisabledClassRoom() {
        return appSettingRepository.findBySettingKey("disabledClassroom")
                .map(s -> s.getSettingValue().isBlank() ? List.<String>of()
                        : Arrays.asList(s.getSettingValue().split(",")))
                .orElse(List.of());

    }

    @Override
    @Transactional
    public void saveDisabledClassroom(List<String> codes,String userId) {
        String value = String.join(",", codes);
        appSettingRepository.findBySettingKey("disabledClassroom").ifPresentOrElse(
                s -> s.updateValue(value),
                () -> appSettingRepository.save(AppSetting.of("disabledClassroom", value)));

        log.info("강의실 비활성화 수정자={} , 비활성화 강의실={}", userId,codes);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getDisabledRooms() {
        return appSettingRepository.findBySettingKey("disabledRoom")
                .map(s -> s.getSettingValue().isBlank() ? List.<String>of()
                        : Arrays.asList(s.getSettingValue().split(",")))
                .orElse(List.of());
    }

    @Override
    @Transactional
    public void saveDisabledRooms(List<String> codes,String userId) {
        String value = String.join(",", codes);
        appSettingRepository.findBySettingKey("disabledRoom").ifPresentOrElse(
                s -> s.updateValue(value),
                () -> appSettingRepository.save(AppSetting.of("disabledRoom", value)));

        log.info("숙소 비활성화 수정자={} , 비활성화 숙소={}", userId,codes);
    }

}
