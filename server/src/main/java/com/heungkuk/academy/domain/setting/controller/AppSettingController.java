package com.heungkuk.academy.domain.setting.controller;

import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.heungkuk.academy.domain.setting.dto.SettingRequest;
import com.heungkuk.academy.domain.setting.service.AppSettingService;
import com.heungkuk.academy.global.response.CommonResponse;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/admin/settings")
@RequiredArgsConstructor
public class AppSettingController {

    private final AppSettingService appSettingService;

    @GetMapping
    public CommonResponse<Map<String, String>> getSettings() {
        return CommonResponse.success(appSettingService.getAll());
    }

    @PutMapping
    public CommonResponse<Void> saveSettings(@RequestBody SettingRequest request) {
        appSettingService.saveAll(request.getSettings());
        return CommonResponse.success("저장되었습니다.", null);
    }

    @GetMapping("/disabledClassroom")
    public CommonResponse<List<String>> getDisabledClassroom() {
        return CommonResponse.success(appSettingService.getDisabledClassRoom());
    }

    @PutMapping("/disabledClassroom")
    public CommonResponse<Void> saveDisabledClassroom(@RequestBody List<String> request) {
        appSettingService.saveDisabledClassroom(request);
        return CommonResponse.success("저장되었습니다.", null);
    }

    @GetMapping("/disabledRoom")
    public CommonResponse<List<String>> getDisabledRoom() {
        return CommonResponse.success(appSettingService.getDisabledRooms());
    }

    @PutMapping("/disabledRoom")
    public CommonResponse<Void> saveDisabledRoom(@RequestBody List<String> request) {
        appSettingService.saveDisabledRooms(request);
        return CommonResponse.success("저장되었습니다.", null);
    }
}
