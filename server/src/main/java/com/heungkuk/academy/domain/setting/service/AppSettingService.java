package com.heungkuk.academy.domain.setting.service;

import java.util.List;
import java.util.Map;

/** 앱 설정(단가·연락처 등) 조회 및 저장 인터페이스 */
public interface AppSettingService {

    /** 전체 설정값 조회 (key-value 맵) */
    Map<String, String> getAll();

    /** 설정값 일괄 저장 (기존 항목은 업데이트, 신규는 insert) */
    void saveAll(Map<String, String> settings);

    /** 사용가능한 강의실 여부 조회 (key-value (List 형식)) */
    List<String> getDisabledClassRoom();

    void saveDisabledClassroom(List<String> disabledClassroom);

    /** 사용불가 숙소 호실 조회 */
    List<String> getDisabledRooms();

    /** 사용불가 숙소 호실 저장 */
    void saveDisabledRooms(List<String> disabledRooms);
}
